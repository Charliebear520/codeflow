import React, { useState } from "react";
import { useSignUp, useAuth } from "@clerk/clerk-react";
import "../styles/Login.css"; // 共用登入頁面的樣式

function SignUpPage() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoaded, signUp, setActive } = useSignUp();

  // 狀態管理
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 處理註冊
  const handleSignUp = async (e) => {
    e.preventDefault();

    if (!isLoaded) return;

    try {
      setIsLoading(true);
      setErrorMessage("");

      // 開始註冊流程
      await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
      });

      // 發送驗證郵件
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

      // 進入驗證階段
      setPendingVerification(true);
    } catch (err) {
      console.error("註冊錯誤:", err);
      setErrorMessage(err.errors?.[0]?.message || "註冊失敗，請檢查您的信息");
    } finally {
      setIsLoading(false);
    }
  };

  // 處理驗證碼提交
  const handleVerification = async (e) => {
    e.preventDefault();

    if (!isLoaded || !pendingVerification) return;

    try {
      setIsLoading(true);
      setErrorMessage("");

      // 嘗試驗證郵箱
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (completeSignUp.status !== "complete") {
        // 驗證未完成
        setErrorMessage("驗證失敗，請檢查驗證碼並重試");
        return;
      }

      // 設置活動會話
      await setActive({ session: completeSignUp.createdSessionId });

      // 重定向到首頁
      window.location.href = "/";
    } catch (err) {
      console.error("驗證錯誤:", err);
      setErrorMessage(err.errors?.[0]?.message || "驗證失敗，請重試");
    } finally {
      setIsLoading(false);
    }
  };

  // 處理社交登入
  const handleSocialSignUp = async (provider) => {
    if (!isLoaded) return;

    try {
      await signUp.authenticateWithRedirect({
        strategy: provider,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err) {
      console.error(`${provider}註冊錯誤:`, err);
      setErrorMessage(`${provider}註冊失敗，請重試`);
    }
  };

  // 如果正在載入，顯示載入狀態
  if (!isLoaded || !isAuthLoaded) {
    return <div className="loading-container">載入中...</div>;
  }

  // 如果已登入，重定向到首頁
  if (isSignedIn) {
    window.location.href = "/";
    return null;
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-image-section">{/* 左側圖片區域 */}</div>
        <div className="login-form-section">
          <div className="login-form-container">
            <div className="custom-auth-container signup-form-container">
              <h1 className="custom-auth-title">註冊帳號</h1>

              {pendingVerification ? (
                <form
                  onSubmit={handleVerification}
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
                    <small>請檢查您的郵箱獲取驗證碼</small>
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
                </form>
              ) : (
                <>
                  <form
                    onSubmit={handleSignUp}
                    className="custom-auth-form signup-form"
                  >
                    <div className="form-row">
                      <div className="custom-form-field">
                        <label htmlFor="firstName">名字</label>
                        <input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="您的名字"
                          required
                        />
                      </div>

                      <div className="custom-form-field">
                        <label htmlFor="lastName">姓氏</label>
                        <input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="您的姓氏"
                          required
                        />
                      </div>
                    </div>

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
                        placeholder="創建密碼"
                        required
                      />
                      <small>密碼至少包含8個字符</small>
                    </div>

                    {errorMessage && (
                      <div className="custom-error-message">{errorMessage}</div>
                    )}

                    <button
                      type="submit"
                      className="custom-submit-button"
                      disabled={isLoading}
                    >
                      {isLoading ? "註冊中..." : "註冊"}
                    </button>
                  </form>

                  <div className="custom-auth-divider">
                    <span>或</span>
                  </div>

                  <div className="custom-social-buttons">
                    <button
                      type="button"
                      className="custom-social-button custom-google-button"
                      onClick={() => handleSocialSignUp("oauth_google")}
                    >
                      <span className="custom-social-icon">G</span>
                      <span>使用Google註冊</span>
                    </button>

                    <button
                      type="button"
                      className="custom-social-button custom-github-button"
                      onClick={() => handleSocialSignUp("oauth_github")}
                    >
                      <span className="custom-social-icon">GH</span>
                      <span>使用GitHub註冊</span>
                    </button>
                  </div>

                  <div className="custom-auth-footer">
                    <span>已有帳號？</span>
                    <a href="/login" className="custom-auth-link">
                      登入
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

export default SignUpPage;
