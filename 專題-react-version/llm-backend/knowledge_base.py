# TTAS 向量知識庫：僅 data/protocol_ttas.csv；LangChain Embeddings + Chroma Retriever

import os
from typing import Any, Dict, List, Optional

import chromadb
from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document

from data_loader import DataLoader

PERSIST_DIR = os.environ.get("CHROMA_PERSIST_DIR", "./chroma_db")
COLLECTION_NAME = "medical_knowledge"
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
                model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                model_kwargs={"device": "cpu"},
                encode_kwargs={"normalize_embeddings": True},
            )
        return self._embeddings

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
        print(f"✅ LangChain Chroma 已載入 TTAS 向量庫：{len(documents)} 筆（來源僅 CSV）")
        return len(documents)

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
        n = self._rebuild_from_csv(_DEFAULT_CSV)
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


knowledge_base = KnowledgeBase()
