import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  useAuth,
  ClerkProvider,
} from "@clerk/clerk-react";
import "./App.css";
import Home from "./pages/Home";
import Tutor from "./pages/Tutor";
import Login from "./pages/Login";
import SignUpPage from "./pages/SignUp";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import UserMenu from "./components/UserMenu";

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

  if (!isLoaded) {
    return <div className="loading-container">處理登入...</div>;
  }

  if (isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to="/login" replace />;
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
              path={"/settings"}
              element={
                <ProtectedRoute>
                  <PageLayout>
                    <Settings />
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
          </Routes>
        </BrowserRouter>
      </div>
    </ClerkProvider>
  );
}

export default App;
