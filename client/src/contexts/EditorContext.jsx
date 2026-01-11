import React, { createContext, useState, useContext } from "react";

// 創建 Context
const EditorContext = createContext({
  stage: 1,
  content: "",
  language: "python",
  updateContent: () => {},
  updateStage: () => {},
  updateLanguage: () => {},
});

// Provider 組件
export const EditorProvider = ({ children }) => {
  const [stage, setStage] = useState(1);
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("python");

  const value = {
    stage,
    content,
    language,
    updateContent: setContent,
    updateStage: setStage,
    updateLanguage: setLanguage,
  };

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
};

// 自定義 Hook
export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditor must be used within EditorProvider");
  }
  return context;
};

export default EditorContext;
