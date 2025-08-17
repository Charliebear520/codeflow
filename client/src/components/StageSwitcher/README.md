# StageSwitcher 階段切換組件

一個自定義的三階段切換組件，具有現代化的設計和流暢的動畫效果。

## 功能特點

- ✅ 被選中的狀態背景色為 `#375BD3`
- ✅ 未被選中的狀態背景色為 `#B2C8FF`
- ✅ 被點擊的狀態略微放大 (scale: 1.15)
- ✅ 懸停效果和點擊動畫
- ✅ 連接線根據進度變化顏色
- ✅ 左右導航按鈕
- ✅ 響應式設計

## 使用方式

```jsx
import StageSwitcher from "../components/StageSwitcher";

function MyComponent() {
  const [currentStage, setCurrentStage] = useState(0);

  return <StageSwitcher current={currentStage} onChange={setCurrentStage} />;
}
```

## Props

| 屬性       | 類型       | 必填 | 說明                 |
| ---------- | ---------- | ---- | -------------------- |
| `current`  | `number`   | ✅   | 當前階段索引 (0-2)   |
| `onChange` | `function` | ✅   | 階段改變時的回調函數 |

## 階段對應

- `current={0}` - 第一階段 (首頁)
- `current={1}` - 第二階段 (stage2)
- `current={2}` - 第三階段 (stage3)

## 樣式特點

### 顏色方案

- **激活狀態**: `#375BD3` (深藍色)
- **未激活狀態**: `#B2C8FF` (淺藍色)
- **懸停效果**: `#9BB8FF` (中等藍色)

### 動畫效果

- **放大效果**: 激活時 scale(1.15)
- **懸停效果**: scale(1.05)
- **點擊效果**: scale(1.1)
- **過渡時間**: 0.3s ease

### 連接線

- 已完成階段的連接線會變為深藍色
- 未完成階段的連接線保持淺藍色
- 具有陰影效果增強視覺層次

## 演示頁面

訪問 `/stage-switcher-demo` 查看組件效果演示。

## 技術實現

- 使用 CSS Modules 避免樣式衝突
- 響應式設計，支持移動端
- 使用 Ant Design Icons 提供導航箭頭
- 支持鍵盤導航和無障礙訪問
