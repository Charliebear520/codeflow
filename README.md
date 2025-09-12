### 注意node version：
- 目前開發用nvm use v23.1.0

### backend資料夾啟動：
```npm start```
### client資料夾啟動：
```yarn run dev```
### Branch-backend_test：目前是來測試把題庫新增到mongoDB資料庫的
---
# 第一次開啟專案
## 在終端機中執行以下指令，將專案複製到本地：
``` git clone https://github.com/Charliebear520/codeflow.git```
## 進入前端專案目錄：
``cd codeflow/client``

``` npm install```

``` yarn install```

``` nvm install v23.1.0```

``` nvm use v23.1.0```
## 新增前端環境變數(詳細請見群組記事本):
- client/.env
```
VITE_CLERK_PUBLISHABLE_KEY=<自行輸入>
VITE_IMAGE_KIT_ENDPOINT=<自行輸入>
VITE_IMAGE_KIT_PUBLIC_KEY=<自行輸入>
VITE_GEMINI_PUBLIC_KEY=<自行輸入>
VITE_API_URL=http://localhost:3000
```
## 啟動前端:
```yarn run dev```
---
## 進入後端專案目錄：
```cd codeflow/backend```

``` npm instal```

``` nvm use v23.1.0```
## 新增後端環境變數(詳細請見群組記事本):
- backend/.env
```
IMAGE_KIT_ENDPOINT=<自行輸入>
IMAGE_KIT_PUBLIC_KEY=<自行輸入>
IMAGE_KIT_PRIVATE_KEY=<自行輸入>
CLIENT_URL=http://localhost:5173
MONGO=<自行輸入>
CLERK_PUBLISHABLE_KEY=<自行輸入>
CLERK_SECRET_KEY=<自行輸入>
GEMINI_API_KEY=<自行輸入> 
PORT=3000
```
## 啟動後端:
```npm start```
