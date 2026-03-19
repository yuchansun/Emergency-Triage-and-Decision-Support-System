import json
import os
import pandas as pd
import PyPDF2
from typing import List, Dict, Any

class DataLoader:
    def load_from_json(self, file_path: str) -> List[Dict[str, Any]]:
        """從 JSON 檔案載入資料"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def load_from_txt(self, file_path: str, category: str) -> List[Dict[str, Any]]:
        """從文字檔案載入資料"""
        documents = []
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            documents.append({
                'id': os.path.basename(file_path),
                'content': content,
                'metadata': {'category': category, 'source': file_path}
            })
        return documents
    
    def load_from_pdf(self, file_path: str, category: str) -> List[Dict[str, Any]]:
        """從 PDF 檔案載入資料"""
        documents = []
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text_content = ""
                
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    text_content += page.extract_text() + "\n"
                
                if text_content.strip():
                    documents.append({
                        'id': os.path.basename(file_path),
                        'content': text_content.strip(),
                        'metadata': {
                            'category': category,
                            'source': file_path,
                            'type': 'pdf',
                            'pages': len(pdf_reader.pages)
                        }
                    })
        except Exception as e:
            print(f"❌ PDF 載入失敗 {file_path}: {e}")
        
        return documents
    
    def load_from_csv(self, file_path: str, category: str, text_column: str = None) -> List[Dict[str, Any]]:
        """從 CSV 檔案載入資料"""
        documents = []
        try:
            # 嘗試不同編碼，特別是 Big5 (台灣編碼)
            encodings = ['utf-8', 'big5', 'gbk', 'latin1']
            df = None
            
            for encoding in encodings:
                try:
                    df = pd.read_csv(file_path, encoding=encoding, on_bad_lines='skip')
                    print(f"✅ 成功用 {encoding} 編碼載入 {file_path}")
                    break
                except UnicodeDecodeError:
                    continue
            
            if df is None:
                raise Exception("無法確定檔案編碼")
            
            for index, row in df.iterrows():
                content = ""
                metadata = {
                    'category': category,
                    'source': file_path,
                    'type': 'csv',
                    'row': index
                }
                
                # 特殊處理 TTAS 格式
                if 'TTAS_DEGREE' in df.columns and 'CC_NAMEC' in df.columns:
                    # TTAS 急診分級格式
                    content_parts = []
                    if pd.notna(row.get('CC_NAMEC')):
                        content_parts.append(f"主訴: {row['CC_NAMEC']}")
                    if pd.notna(row.get('JUDGE_NAMEC')):
                        content_parts.append(f"判斷: {row['JUDGE_NAMEC']}")
                    if pd.notna(row.get('TTAS_DEGREE')):
                        content_parts.append(f"檢傷分級: {row['TTAS_DEGREE']}")
                    if pd.notna(row.get('T_NAMEC')):
                        content_parts.append(f"傷病類型: {row['T_NAMEC']}")
                    
                    content = " | ".join(content_parts)
                    metadata.update({
                        'symptom': row.get('CC_NAMEC', ''),
                        'judgment': row.get('JUDGE_NAMEC', ''),
                        'ttas_level': str(row.get('TTAS_DEGREE', '')),
                        'body_part': row.get('T_NAMEC', '')
                    })
                else:
                    # 一般 CSV 處理
                    if text_column and text_column in df.columns:
                        content = str(row[text_column])
                    elif 'content' in df.columns:
                        content = str(row['content'])
                    elif 'text' in df.columns:
                        content = str(row['text'])
                    else:
                        # 如果沒有指定欄位，合併所有欄位
                        content = " | ".join([f"{col}: {val}" for col, val in row.items()])
                
                if content.strip():
                    documents.append({
                        'id': f"{os.path.basename(file_path)}_row_{index}",
                        'content': content.strip(),
                        'metadata': metadata
                    })
        except Exception as e:
            print(f"❌ CSV 載入失敗 {file_path}: {e}")
        
        return documents