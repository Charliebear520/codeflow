import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "antd";
import StudentsRecords from "../../src/components/StudentsRecords";
import "../../src/index.css";
import "../../src/App.css";

createRoot(document.getElementById("root")).render(<App><div className="app-container">
  <header className="app-header"><a className="app-logo">CodeFlow</a><small style={{color:"#7886a5"}}>隔離版面檢查 · 僅示範資料 · 非登入驗收</small></header>
  <main className="page-content"><StudentsRecords /></main>
</div></App>);
