import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  useAuth,
  ClerkProvider,
  useSignIn,
  useClerk,
} from "@clerk/clerk-react";
import "./App.css";
import Home from "./pages/Home";
import Tutor from "./pages/Tutor";
import Login from "./pages/Login";
import SignUpPage from "./pages/SignUp";
import Profile from "./pages/Profile";
import UserMenu from "./components/UserMenu";
import ForgotPassword from "./pages/ForgotPassword";
import Stage2Page from "./pages/Stage2Page.jsx";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

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

// SSO 回調組件
const SSOCallback = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const { handleRedirectCallback } = useClerk();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log("開始處理 SSO 回調...");
        const result = await handleRedirectCallback();
        console.log("SSO 回調結果:", result);

        // 檢查認證狀態
        setTimeout(() => {
          if (isSignedIn) {
            console.log("用戶已登入，重定向到首頁");
            navigate("/", { replace: true });
          } else {
            console.log("認證成功但用戶未登入");
            navigate("/login", { replace: true });
          }
        }, 500);
      } catch (err) {
        console.error("處理回調時發生錯誤:", err);
        console.error("錯誤詳情:", {
          name: err.name,
          message: err.message,
          stack: err.stack,
        });
        navigate("/login", { replace: true });
      }
    };

    if (isLoaded) {
      console.log("Clerk 已載入，開始處理回調");
      handleCallback();
    } else {
      console.log("等待 Clerk 載入...");
    }
  }, [isLoaded, isSignedIn, navigate, handleRedirectCallback]);

  // 顯示載入狀態
  return (
    <div className="loading-container">
      <div>處理登入中...</div>
      <div style={{ fontSize: "14px", marginTop: "10px", color: "#666" }}>
        請稍候，正在完成登入流程
      </div>
    </div>
  );
};

// 添加導航欄組件
const Header = () => {
  return (
    <header className="app-header">
      <div className="header-left">
        <a href="/" className="app-logo">
          CodeFlow
        </a>
      </div>
      <div className="header-right">
        <SignedIn>
          <UserMenu />
        </SignedIn>
        <SignedOut>
          <div className="auth-links">
            <a href="/login" className="login-link">
              登入
            </a>
            <a href="/signup" className="signup-link">
              註冊
            </a>
          </div>
        </SignedOut>
      </div>
    </header>
  );
};

// 頁面佈局組件 - 包含頭部和內容區域
const PageLayout = ({ children }) => {
  return (
    <>
      <Header />
      <div className="page-content">{children}</div>
    </>
  );
};

function App() {
  // 從環境變量中獲取Clerk公鑰
  const clerkPubKey =
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_placeholder_key";

  // 如果沒有配置Clerk公鑰，顯示錯誤信息
  if (!clerkPubKey || clerkPubKey === "pk_test_placeholder_key") {
    console.error(
      "錯誤: 缺少Clerk公鑰。請在.env文件中設置VITE_CLERK_PUBLISHABLE_KEY"
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <div className="app-container">
        <BrowserRouter>
          <Routes>
            <Route
              path={"/"}
              element={
                <ProtectedRoute>
                  <PageLayout>
                    <Home />
                  </PageLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path={"/tutor"}
              element={
                <ProtectedRoute>
                  <PageLayout>
                    <Tutor />
                  </PageLayout>
                </ProtectedRoute>
              }
            />
            {/* 個人資料相關路由 */}
            <Route
              path={"/profile"}
              element={
                <ProtectedRoute>
                  <PageLayout>
                    <Profile />
                  </PageLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path={"/profile/:section"}
              element={
                <ProtectedRoute>
                  <PageLayout>
                    <Profile />
                  </PageLayout>
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
            <Route path={"/sso-callback"} element={<SSOCallback />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route
              path={"/stage2"}
              element={
                <ProtectedRoute>
                  <PageLayout>
                    <Stage2Page />
                  </PageLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </div>
    </ClerkProvider>
  );
}

export default App;
