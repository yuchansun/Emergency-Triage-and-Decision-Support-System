# TTAS 向量知識庫：僅 data/protocol_ttas.csv；LangChain Embeddings + Chroma Retriever

import hashlib
import json
import os
from typing import Any, Dict, List, Optional

import chromadb
from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document

from data_loader import DataLoader

PERSIST_DIR = os.environ.get("CHROMA_PERSIST_DIR", "./chroma_db")
COLLECTION_NAME = "medical_knowledge"
_MANIFEST_PATH = os.path.join(PERSIST_DIR, ".kb_manifest.json")
_EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
_DEFAULT_CSV = os.path.join(os.path.dirname(__file__), "data", "protocol_ttas.csv")


def _sanitize_meta(meta: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k, v in meta.items():
        if v is None:
            continue
        if hasattr(v, "item"):
            try:
                v = v.item()
            except Exception:
                v = str(v)
        if isinstance(v, float) and (v != v):
            continue
        if isinstance(v, (int, float, bool)):
            out[k] = v
            continue
        s = str(v).strip()
        if not s:
            continue
        out[k] = s[:2000]
    return out


class KnowledgeBase:
    def __init__(self) -> None:
        self._embeddings: Optional[HuggingFaceEmbeddings] = None
        self._vs: Optional[Chroma] = None

    def _get_embeddings(self) -> HuggingFaceEmbeddings:
        if self._embeddings is None:
            self._embeddings = HuggingFaceEmbeddings(
                model_name=_EMBEDDING_MODEL,
                model_kwargs={"device": "cpu"},
                encode_kwargs={"normalize_embeddings": True},
            )
        return self._embeddings

    def _csv_fingerprint(self, csv_path: str) -> str:
        digest = hashlib.sha256()
        with open(csv_path, "rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def _load_manifest(self) -> Optional[Dict[str, Any]]:
        if not os.path.isfile(_MANIFEST_PATH):
            return None
        try:
            with open(_MANIFEST_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    def _save_manifest(self, csv_path: str, doc_count: int) -> None:
        os.makedirs(PERSIST_DIR, exist_ok=True)
        payload = {
            "csv_path": os.path.abspath(csv_path),
            "csv_sha256": self._csv_fingerprint(csv_path),
            "doc_count": doc_count,
            "embedding_model": _EMBEDDING_MODEL,
        }
        with open(_MANIFEST_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def _collection_doc_count(self) -> int:
        client = chromadb.PersistentClient(path=PERSIST_DIR)
        try:
            collection = client.get_collection(COLLECTION_NAME)
            return int(collection.count())
        except Exception:
            return 0

    def _can_reuse_existing_index(self, csv_path: str) -> bool:
        if os.environ.get("CHROMA_FORCE_REBUILD", "").strip().lower() in {"1", "true", "yes"}:
            print("♻️ CHROMA_FORCE_REBUILD 已啟用，將重新建立向量庫")
            return False

        manifest = self._load_manifest()
        if not manifest:
            return False

        if manifest.get("embedding_model") != _EMBEDDING_MODEL:
            print("♻️ Embedding 模型已變更，將重新建立向量庫")
            return False

        if not os.path.isfile(csv_path):
            return False

        try:
            if manifest.get("csv_sha256") != self._csv_fingerprint(csv_path):
                print("♻️ 偵測到 TTAS CSV 內容變更，將重新建立向量庫")
                return False
        except OSError as e:
            print(f"⚠️ 無法讀取 CSV 指紋：{e}")
            return False

        doc_count = self._collection_doc_count()
        expected = int(manifest.get("doc_count") or 0)
        if doc_count <= 0 or (expected > 0 and doc_count != expected):
            print(
                f"♻️ 向量庫筆數不符（磁碟 {doc_count} / manifest {expected}），將重新建立"
            )
            return False

        return True

    def _load_existing_vectorstore(self) -> int:
        _ = self._vectorstore
        return self._collection_doc_count()

    def _clear_chroma_collection(self) -> None:
        client = chromadb.PersistentClient(path=PERSIST_DIR)
        try:
            client.delete_collection(COLLECTION_NAME)
            print(f"🗑️ 已刪除 Chroma collection：{COLLECTION_NAME}")
        except Exception:
            pass
        self._vs = None

    def _rebuild_from_csv(self, csv_path: str) -> int:
        if not os.path.isfile(csv_path):
            raise FileNotFoundError(f"找不到 TTAS CSV：{csv_path}")

        self._clear_chroma_collection()
        loader = DataLoader()
        raw_docs = loader.load_from_csv(csv_path, "ttas_protocol")
        documents: List[Document] = []
        for d in raw_docs:
            meta = _sanitize_meta(d.get("metadata") or {})
            meta.setdefault("category", "ttas_protocol")
            meta.setdefault("source", csv_path)
            documents.append(
                Document(page_content=d.get("content", ""), metadata=meta)
            )

        embeddings = self._get_embeddings()
        client = chromadb.PersistentClient(path=PERSIST_DIR)
        self._vs = Chroma.from_documents(
            documents=documents,
            embedding=embeddings,
            client=client,
            collection_name=COLLECTION_NAME,
        )
        doc_count = len(documents)
        self._save_manifest(csv_path, doc_count)
        print(f"✅ LangChain Chroma 已載入 TTAS 向量庫：{doc_count} 筆（來源僅 CSV）")
        return doc_count

    @property
    def _vectorstore(self) -> Chroma:
        if self._vs is None:
            embeddings = self._get_embeddings()
            self._vs = Chroma(
                persist_directory=PERSIST_DIR,
                collection_name=COLLECTION_NAME,
                embedding_function=embeddings,
            )
        return self._vs

    def _invoke_retriever(self, query: str, k: int) -> List[Document]:
        r = self._vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": k},
        )
        return r.invoke(query)

    def initialize_knowledge_base(self) -> None:
        print("🚀 初始化 TTAS 向量知識庫（僅 CSV）...")
        csv_path = _DEFAULT_CSV
        if self._can_reuse_existing_index(csv_path):
            n = self._load_existing_vectorstore()
            print(f"⚡ 沿用既有 Chroma 向量庫（{n} 筆），略過重建")
            print(f"✅ TTAS 向量庫就緒，共 {n} 筆規則列")
            return

        n = self._rebuild_from_csv(csv_path)
        print(f"✅ TTAS 向量庫就緒，共 {n} 筆規則列")

    def search_medical_knowledge(
        self, query: str, category: Optional[str] = None, n_results: int = 5
    ) -> List[Dict[str, Any]]:
        docs = self._invoke_retriever(query, k=n_results)
        rows: List[Dict[str, Any]] = []
        for i, doc in enumerate(docs):
            meta = dict(doc.metadata or {})
            if category and meta.get("category") != category:
                continue
            rid = meta.get("row", i)
            src = os.path.basename(str(meta.get("source", "ttas")))
            rows.append(
                {
                    "id": f"{src}_{rid}_{i}",
                    "content": doc.page_content,
                    "metadata": meta,
                    "distance": None,
                }
            )
        return rows

    # ------------------------------------------------------------------
    # 共用 embedding：給 rag_pipeline.find_similar_symptoms 等上層直接使用，
    # 避免另外實例化 SentenceTransformer 重複載入模型。
    # 注意：HuggingFaceEmbeddings 已將 normalize_embeddings=True 設好，
    # 所以兩個向量做 dot product 就等於 cosine similarity。
    # ------------------------------------------------------------------
    def embed_query(self, text: str) -> List[float]:
        return self._get_embeddings().embed_query(text)

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        return self._get_embeddings().embed_documents(list(texts))


knowledge_base = KnowledgeBase()
