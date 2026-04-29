# 向量資料庫，儲存醫學知識的數學表示

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Dict, Any, Optional
import json
import os

class VectorStore:
    def __init__(self, persist_directory: str = "./chroma_db"):
        """
        初始化向量儲存
        Args:
            persist_directory: ChromaDB 資料庫儲存路徑
        """
        self.persist_directory = persist_directory
        # 初始化 ChromaDB 的 PersistentClient，確保資料會儲存到磁碟
        self.client = chromadb.PersistentClient(path=persist_directory)
        # 使用 SentenceTransformer 模型將文本轉換為向量，支援多語言（包含中文）
        self.embedding_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        
        # 建立或獲取一個名為 medical_knowledge 的 collection，用於儲存醫學知識
        self.collection = self.client.get_or_create_collection(
            name="medical_knowledge",
            metadata={"description": "急診檢傷醫學知識庫"}
        )
    
    def add_documents(self, documents: List[Dict[str, Any]]) -> List[str]:
        """
        添加文檔到向量儲存
        Args:
            documents: 文檔列表，每個文檔包含 id, content, metadata
        Returns:
            新增的文檔 ID 列表
        """
        ids = []
        contents = []
        metadatas = []
        
        for doc in documents:
            # 提取文檔的 id、內容和元數據
            ids.append(str(doc.get('id', '')))
            contents.append(doc.get('content', ''))
            metadatas.append(doc.get('metadata', {}))
        
        # 使用模型將內容轉換為向量
        embeddings = self.embedding_model.encode(contents).tolist()
        
        # 將向量、原始內容和元數據添加到 ChromaDB 的 collection
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=contents,
            metadatas=metadatas
        )
        
        print(f"✅ 成功添加 {len(documents)} 筆文檔到向量資料庫")
        return ids
    
    def search(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """
        搜尋相似文檔
        Args:
            query: 搜尋查詢
            n_results: 返回結果數量
        Returns:
            相似文檔列表
        """
        # 將查詢語句轉換為向量
        query_embedding = self.embedding_model.encode([query]).tolist()
        
        # 使用 ChromaDB 查詢與查詢向量最相似的文檔
        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=n_results
        )
        
        # 格式化查詢結果，包含 id、內容、元數據和距離
        formatted_results = []
        for i in range(len(results['ids'][0])):
            formatted_results.append({
                'id': results['ids'][0][i],
                'content': results['documents'][0][i],
                'metadata': results['metadatas'][0][i],
                'distance': results['distances'][0][i] if 'distances' in results else None
            })
        
        return formatted_results
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """獲取 collection 統計資訊"""
        # 獲取 collection 中的文檔總數
        count = self.collection.count()
        return {
            'total_documents': count,
            'collection_name': self.collection.name,
            'persist_directory': self.persist_directory
        }
    
    def delete_collection(self):
        """刪除整個 collection (重新開始用)"""
        # 刪除名為 medical_knowledge 的 collection
        self.client.delete_collection("medical_knowledge")
        print("🗑️ 已刪除 medical_knowledge collection")

# 初始化全域向量儲存實例
vector_store = VectorStore()