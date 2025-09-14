import React, { useState, useEffect } from "react";
import { useSignIn, useAuth } from "@clerk/clerk-react";
import "../styles/Login.css";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();

  // 狀態管理
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showVerification, setShowVerification] = useState(false);

  // 處理忘記密碼
  const handleForgotPassword = async () => {
    if (!isLoaded) return;

    try {
      setIsLoading(true);
      setErrorMessage("");

      // 使用 Clerk 的忘記密碼功能
      await signIn.create({
        strategy: "reset_password_email",
        identifier: email,
      });

      // 顯示成功消息
      setErrorMessage("重置密碼的郵件已發送到您的郵箱，請查收。");
    } catch (err) {
      console.error("忘記密碼錯誤:", err);
      setErrorMessage(
        err.errors?.[0]?.message || "發送重置密碼郵件失敗，請重試"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 處理電子郵件密碼登入
  const handleEmailPasswordSignIn = async (e) => {
    e.preventDefault();

    if (!isLoaded) return;

    try {
      setIsLoading(true);
      setErrorMessage("");

      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        // 登入成功，設置活動會話
        await setActive({ session: result.createdSessionId });
        window.location.href = "/"; // 重定向到首頁
      } else if (result.status === "needs_second_factor") {
        // 處理雙因素驗證
        setVerifying(true);
      } else if (
        result.status === "needs_identifier" ||
        result.status === "needs_password"
      ) {
        setErrorMessage("請輸入有效的電子郵件和密碼");
      } else {
        setErrorMessage("登入過程中出現錯誤，請重試");
      }
    } catch (err) {
      console.error("登入錯誤:", err);
      setErrorMessage(err.errors?.[0]?.message || "登入失敗，請檢查您的憑據");
    } finally {
      setIsLoading(false);
    }
  };

  // 處理驗證碼提交
  const handleVerificationSubmit = async (e) => {
    e.preventDefault();

    if (!isLoaded || !verifying) return;

    try {
      setIsLoading(true);
      setErrorMessage("");

      const result = await signIn.attemptSecondFactor({
        strategy: "phone_code",
        code: verificationCode,
      });

      if (result.status === "complete") {
        // 驗證成功，設置活動會話
        await setActive({ session: result.createdSessionId });
        window.location.href = "/"; // 重定向到首頁
      } else {
        setErrorMessage("驗證失敗，請檢查您的驗證碼");
      }
    } catch (err) {
      console.error("驗證錯誤:", err);
      setErrorMessage(err.errors?.[0]?.message || "驗證失敗，請重試");
    } finally {
      setIsLoading(false);
    }
  };

  // 處理第三方登入
  const handleSocialSignIn = async (strategy) => {
    try {
      setIsLoading(true);
      console.log(`開始 ${strategy} 登入流程...`);

      // 使用 signIn.authenticateWithRedirect
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: window.location.origin + "/sso-callback",
        redirectUrlComplete: window.location.origin + "/",
      });

      console.log(`${strategy} 登入重定向已啟動`);
    } catch (err) {
      console.error(`${strategy} 登入失敗:`, err);
      setErrorMessage(err.message || "登入失敗，請稍後再試");
    } finally {
      setIsLoading(false);
    }
  };

  // 如果已登入，重定向到首頁
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      console.log("User is already signed in, redirecting to home");
      window.location.href = "/";
    }
  }, [isLoaded, isSignedIn]);

  // 如果正在載入，顯示載入狀態
  if (!isLoaded || !isAuthLoaded) {
    return <div className="loading-container">載入中...</div>;
  }

  // 如果已登入，不顯示登入頁面
  if (isSignedIn) {
    return null;
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-image-section">{/* 左側圖片區域 */}</div>
        <div className="login-form-section">
          <div className="login-form-container">
            <div className="custom-auth-container">
              <h1 className="custom-auth-title">登入</h1>

              {verifying ? (
                <form
                  onSubmit={handleVerificationSubmit}
                  className="custom-auth-form"
                >
                  <div className="custom-form-field">
                    <label htmlFor="verificationCode">驗證碼</label>
                    <input
                      id="verificationCode"
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="輸入驗證碼"
                      required
                    />
                  </div>

                  {errorMessage && (
                    <div className="custom-error-message">{errorMessage}</div>
                  )}

                  <button
                    type="submit"
                    className="custom-submit-button"
                    disabled={isLoading}
                  >
                    {isLoading ? "驗證中..." : "驗證"}
                  </button>

                  <button
                    type="button"
                    className="custom-back-button"
                    onClick={() => setVerifying(false)}
                    disabled={isLoading}
                  >
                    返回
                  </button>
                </form>
              ) : (
                <>
                  <form
                    onSubmit={handleEmailPasswordSignIn}
                    className="custom-auth-form"
                  >
                    <div className="custom-form-field">
                      <label htmlFor="email">電子郵件</label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        required
                      />
                    </div>

                    <div className="custom-form-field">
                      <label htmlFor="password">密碼</label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="請輸入密碼"
                        required
                      />
                    </div>

                    <div className="login-options">
                      <div className="remember-me">
                        <input
                          type="checkbox"
                          id="remember"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <label htmlFor="remember">記住密碼</label>
                      </div>
                      <button
                        type="button"
                        className="forgot-password"
                        onClick={handleForgotPassword}
                      >
                        忘記密碼？
                      </button>
                    </div>

                    {errorMessage && (
                      <div className="custom-error-message">{errorMessage}</div>
                    )}

                    <button
                      type="submit"
                      className="custom-submit-button"
                      disabled={isLoading}
                    >
                      {isLoading ? "登入中..." : "登入"}
                    </button>
                  </form>

                  <div className="custom-auth-divider">
                    <span>或</span>
                  </div>

                  <div className="custom-social-buttons">
                    <button
                      type="button"
                      className="custom-social-button google-button"
                      onClick={() => handleSocialSignIn("oauth_google")}
                    >
                      <img
                        src="https://www.google.com/favicon.ico"
                        alt="Google"
                        className="social-icon"
                      />
                      <span>使用 Google 登入</span>
                    </button>
                  </div>

                  <div className="custom-auth-footer">
                    <span>還沒有帳號？</span>
                    <a href="/signup" className="custom-auth-link">
                      註冊
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
