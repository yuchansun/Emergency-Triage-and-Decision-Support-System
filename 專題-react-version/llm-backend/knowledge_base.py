#醫學知識庫管理，包含檢傷分級、症狀對應等

from typing import List, Dict, Any
import json
import os
from vector_store import vector_store

class KnowledgeBase:
    def __init__(self):
        self.vector_store = vector_store
    
    def load_triage_guidelines(self) -> List[Dict[str, Any]]:
        """載入檢傷分級指引"""
        guidelines = [
            {
                'id': 'triage_level_1',
                'content': '第一級檢傷：立即處理。包括心臟停止、嚴重呼吸困難、大量出血、意識不清、生命徵象不穩定等危急狀態。',
                'metadata': {
                    'category': 'triage_level',
                    'level': 1,
                    'urgency': 'immediate',
                    'keywords': ['心臟停止', '呼吸困難', '出血', '意識不清', '生命徵象']
                }
            },
            {
                'id': 'triage_level_2',
                'content': '第二級檢檢傷：緊急處理。包括可能惡化的骨折、中度胸痛、持續嘔吐、高燒、穩定但需密切觀察的狀態。',
                'metadata': {
                    'category': 'triage_level',
                    'level': 2,
                    'urgency': 'emergency',
                    'keywords': ['骨折', '胸痛', '嘔吐', '高燒', '密切觀察']
                }
            },
            {
                'id': 'triage_level_3',
                'content': '第三級檢傷：急診處理。包括輕微外傷、發燒、頭痛、腹痛等非立即危及生命的狀態。',
                'metadata': {
                    'category': 'triage_level',
                    'level': 3,
                    'urgency': 'urgent',
                    'keywords': ['外傷', '發燒', '頭痛', '腹痛']
                }
            },
            {
                'id': 'triage_level_4',
                'content': '第四級檢傷：次急診處理。包括慢性病惡化、輕微感染、舊傷復發等可等待的狀態。',
                'metadata': {
                    'category': 'triage_level',
                    'level': 4,
                    'urgency': 'semi_urgent',
                    'keywords': ['慢性病', '感染', '舊傷', '可等待']
                }
            },
            {
                'id': 'triage_level_5',
                'content': '第五級檢傷：非急診。包括輕微感冒、皮膚問題、定期用藥等可門診處理的狀態。',
                'metadata': {
                    'category': 'triage_level',
                    'level': 5,
                    'urgency': 'non_urgent',
                    'keywords': ['感冒', '皮膚', '用藥', '門診']
                }
            }
        ]
        return guidelines

    def load_symptom_disease_mapping(self) -> List[Dict[str, Any]]:
        """載入症狀疾病對應資料"""
        mappings = [
            {
                'id': 'chest_pain_mapping',
                'content': '胸痛可能原因：心肌梗塞、肺栓塞、主動脈剝離、氣胸、食道疾病、肌肉骨骼疼痛。需要立即評估ECG、血壓、呼吸狀態。',
                'metadata': {
                    'category': 'symptom_mapping',
                    'primary_symptom': '胸痛',
                    'urgency': 'high',
                    'exams': ['ECG', '血壓', '呼吸狀態'],
                    'keywords': ['胸痛', '心臟', '呼吸', 'ECG']
                }
            },
            {
                'id': 'headache_mapping',
                'content': '頭痛可能原因：偏頭痛、緊張性頭痛、腦中風、腦膜炎、腫瘤。需評估發作時間、嚴重程度、伴隨症狀。',
                'metadata': {
                    'category': 'symptom_mapping',
                    'primary_symptom': '頭痛',
                    'urgency': 'medium',
                    'exams': ['神經學檢查', '血壓', '視力檢查'],
                    'keywords': ['頭痛', '偏頭痛', '中風', '神經']
                }
            },
            {
                'id': 'abdominal_pain_mapping',
                'content': '腹痛可能原因：闌尾炎、膽囊炎、胰腺炎、腸阻塞、胃潰瘍。需評估位置、性質、嚴重程度。',
                'metadata': {
                    'category': 'symptom_mapping',
                    'primary_symptom': '腹痛',
                    'urgency': 'medium',
                    'exams': ['腹部觸診', '影像檢查', '血液檢查'],
                    'keywords': ['腹痛', '闌尾炎', '膽囊', '胰腺']
                }
            },
            {
                'id': 'difficulty_breathing_mapping',
                'content': '呼吸困難可能原因：哮喘、COPD、肺炎、肺水腫、氣胸。需評估血氧飽和度、呼吸音、意識狀態。',
                'metadata': {
                    'category': 'symptom_mapping',
                    'primary_symptom': '呼吸困難',
                    'urgency': 'high',
                    'exams': ['血氧飽和度', '呼吸音', '胸部X光'],
                    'keywords': ['呼吸困難', '哮喘', '肺炎', '血氧']
                }
            }
        ]
        return mappings
    
    def load_emergency_protocols(self) -> List[Dict[str, Any]]:
        """載入急診處理協議"""
        protocols = [
            {
                'id': 'cardiac_arrest_protocol',
                'content': '心臟停止處理：立即CPR、氣道維持、除顫器準備、腎上腺素給藥。每2分鐘評估一次心律。',
                'metadata': {
                    'category': 'emergency_protocol',
                    'condition': '心臟停止',
                    'urgency': 'critical',
                    'time_sensitive': True,
                    'keywords': ['CPR', '除顫', '腎上腺素', '急救']
                }
            },
            {
                'id': 'severe_bleeding_protocol',
                'content': '嚴重出血處理：直接壓迫、抬高患部、止血帶使用、靜脈輸液、血型鑑定備血。',
                'metadata': {
                    'category': 'emergency_protocol',
                    'condition': '嚴重出血',
                    'urgency': 'critical',
                    'time_sensitive': True,
                    'keywords': ['出血', '壓迫', '止血帶', '輸血']
                }
            }
        ]
        return protocols
    
    def initialize_knowledge_base(self):
        """初始化知識庫，載入所有醫學知識"""
        print("🚀 開始初始化醫學知識庫...")
        
        all_documents = []
        
        # 1. 載入預設的檢傷分級指引
        triage_docs = self.load_triage_guidelines()
        all_documents.extend(triage_docs)
        
        # 2. 載入症狀-疾病對應
        symptom_docs = self.load_symptom_disease_mapping()
        all_documents.extend(symptom_docs)
        
        # 3. 載入急診處理協議
        emergency_docs = self.load_emergency_protocols()
        all_documents.extend(emergency_docs)
        
        # 4. 載入真實資料檔案（統一在 data/ 目錄）
        from data_loader import DataLoader
        data_loader = DataLoader()
        
        data_dir = './data'
        if os.path.exists(data_dir):
            for filename in os.listdir(data_dir):
                file_path = os.path.join(data_dir, filename)
                
                if filename.startswith('protocol_'):
                    if filename.endswith('.json'):
                        docs = data_loader.load_from_json(file_path)
                        all_documents.extend(docs)
                    elif filename.endswith('.txt'):
                        docs = data_loader.load_from_txt(file_path, 'hospital_protocol')
                        all_documents.extend(docs)
                    elif filename.endswith('.pdf'):
                        docs = data_loader.load_from_pdf(file_path, 'hospital_protocol')
                        all_documents.extend(docs)
                    elif filename.endswith('.csv'):
                        docs = data_loader.load_from_csv(file_path, 'hospital_protocol')
                        all_documents.extend(docs)
                
                elif filename.startswith('guideline_'):
                    if filename.endswith('.json'):
                        docs = data_loader.load_from_json(file_path)
                        all_documents.extend(docs)
                    elif filename.endswith('.txt'):
                        docs = data_loader.load_from_txt(file_path, 'medical_guideline')
                        all_documents.extend(docs)
                    elif filename.endswith('.pdf'):
                        docs = data_loader.load_from_pdf(file_path, 'medical_guideline')
                        all_documents.extend(docs)
                    elif filename.endswith('.csv'):
                        docs = data_loader.load_from_csv(file_path, 'medical_guideline')
                        all_documents.extend(docs)
        
        # 添加到向量資料庫
        if all_documents:
            self.vector_store.add_documents(all_documents)
            print(f"✅ 成功添加 {len(all_documents)} 筆文檔到向量資料庫")
        else:
            print("⚠️  沒有找到任何文檔")
        
        print("✅ 成功載入醫學知識庫")

    def search_medical_knowledge(self, query: str, category: str = None, n_results: int = 5) -> List[Dict[str, Any]]:
        """搜尋醫學知識"""
        results = self.vector_store.search(query, n_results)
        
        # 如果指定了類別，進行過濾
        if category:
            filtered_results = []
            for result in results:
                if result.get('metadata', {}).get('category') == category:
                    filtered_results.append(result)
            return filtered_results
        
        return results

# 初始化知識庫實例
knowledge_base = KnowledgeBase()