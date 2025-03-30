import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import "./App.css";
import Home from "./pages/Home";
import Tutor from "./pages/Tutor";
import Login from "./pages/Login";
import SignUpPage from "./pages/SignUp";

// 建立一個需要認證的路由元件
const ProtectedRoute = ({ children }) => {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/login" replace />
      </SignedOut>
    </>
  );
};

// 建立一個只允許未登入用戶訪問的路由
const PublicOnlyRoute = ({ children }) => {
  return (
    <>
      <SignedIn>
        <Navigate to="/" replace />
      </SignedIn>
      <SignedOut>{children}</SignedOut>
    </>
  );
};

function App() {
  return (
    <div style={{ width: "100%", overflowX: "hidden" }}>
      <BrowserRouter>
        <Routes>
          <Route
            path={"/"}
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path={"/tutor"}
            element={
              <ProtectedRoute>
                <Tutor />
              </ProtectedRoute>
            }
          />
          <Route
            path={"/login"}
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />
          <Route
            path={"/signup"}
            element={
              <PublicOnlyRoute>
                <SignUpPage />
              </PublicOnlyRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
