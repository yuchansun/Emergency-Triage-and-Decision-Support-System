#向量資料庫，儲存醫學知識的數學表示

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
        self.client = chromadb.PersistentClient(path=persist_directory)
        self.embedding_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')  # 支援中文
        
        # 建立或獲取 collection
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
            ids.append(str(doc.get('id', '')))
            contents.append(doc.get('content', ''))
            metadatas.append(doc.get('metadata', {}))
        
        # 生成嵌入向量
        embeddings = self.embedding_model.encode(contents).tolist()
        
        # 添加到 ChromaDB
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
        # 生成查詢向量
        query_embedding = self.embedding_model.encode([query]).tolist()
        
        # 執行搜尋
        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=n_results
        )
        
        # 格式化結果
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
        count = self.collection.count()
        return {
            'total_documents': count,
            'collection_name': self.collection.name,
            'persist_directory': self.persist_directory
        }
    
    def delete_collection(self):
        """刪除整個 collection (重新開始用)"""
        self.client.delete_collection("medical_knowledge")
        print("🗑️ 已刪除 medical_knowledge collection")

# 初始化全域向量儲存實例
vector_store = VectorStore()