# MySQL 匯入檔（選用）

此目錄可選擇性存放 `.sql` 匯入檔，方便組員取得。**非執行時必要路徑。**

實際運作方式：

1. 安裝時：用 phpMyAdmin 將 `.sql` **匯入 MySQL**（檔案在電腦任意位置皆可）
2. 執行時：後端 `api/db.py` 依 `api/.env` **連線 MySQL**，不讀此目錄

詳見根目錄 [README.md](../../README.md) 第 6 節。
