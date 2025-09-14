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

  // 密码强度检查
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  // 密碼顯示/隱藏狀態
  const [showPassword, setShowPassword] = useState(false);

  // 檢查密碼強度
  const checkPasswordStrength = (password) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
    setPasswordChecks(checks);
  };

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
      });

      // 發送驗證郵件
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

      // 進入驗證階段
      setPendingVerification(true);
    } catch (err) {
      console.error("註冊錯誤:", err);

      // 解析並顯示更具體的錯誤信息
      let errorMsg = "註冊失敗，請重試";

      if (err.errors && err.errors.length > 0) {
        const error = err.errors[0];
        switch (error.code) {
          case "form_identifier_exists":
            errorMsg = "此電子郵件已被註冊，請使用其他郵箱或直接登入";
            break;
          case "form_password_pwned":
            errorMsg =
              "此密碼安全性不足，為了您的帳戶安全，請選擇一個全新的密碼";
            break;
          case "form_password_size_in_bytes":
            errorMsg = "密碼長度不符合要求，請輸入至少8個字符";
            break;
          case "form_identifier_invalid":
            errorMsg = "電子郵件格式不正確，請檢查後重試";
            break;
          case "form_password_not_strong_enough":
            errorMsg = "密碼強度不足，請包含字母、數字和特殊字符";
            break;
          default:
            errorMsg = error.message || "註冊失敗，請檢查您的信息";
        }
      } else if (err.message) {
        errorMsg = err.message;
      }

      setErrorMessage(errorMsg);
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

      // 解析並顯示更具體的驗證錯誤信息
      let errorMsg = "驗證失敗，請重試";

      if (err.errors && err.errors.length > 0) {
        const error = err.errors[0];
        switch (error.code) {
          case "form_code_incorrect":
            errorMsg = "驗證碼不正確，請檢查後重試";
            break;
          case "form_code_expired":
            errorMsg = "驗證碼已過期，請重新發送驗證碼";
            break;
          case "form_code_invalid":
            errorMsg = "驗證碼格式不正確，請檢查後重試";
            break;
          default:
            errorMsg = error.message || "驗證失敗，請重試";
        }
      } else if (err.message) {
        errorMsg = err.message;
      }

      setErrorMessage(errorMsg);
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

      // 解析社交登入錯誤信息
      let errorMsg = `${provider}註冊失敗，請重試`;

      if (err.errors && err.errors.length > 0) {
        const error = err.errors[0];
        switch (error.code) {
          case "oauth_access_denied":
            errorMsg = `${provider}登入被取消，請重試`;
            break;
          case "oauth_account_already_exists":
            errorMsg = `此${provider}帳號已存在，請直接登入`;
            break;
          default:
            errorMsg = error.message || `${provider}註冊失敗，請重試`;
        }
      } else if (err.message) {
        errorMsg = err.message;
      }

      setErrorMessage(errorMsg);
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
                      <div className="password-input-container">
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            checkPasswordStrength(e.target.value);
                          }}
                          placeholder="創建密碼"
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex="-1"
                        >
                          {showPassword ? (
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          ) : (
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {password && (
                        <div className="password-strength-checker">
                          <div className="password-requirement">
                            {passwordChecks.length ? (
                              <span className="requirement-check">✓</span>
                            ) : (
                              <span className="requirement-dot invalid"></span>
                            )}
                            <span
                              className={`requirement-text ${
                                passwordChecks.length ? "valid" : "invalid"
                              }`}
                            >
                              至少8個字符
                            </span>
                          </div>
                          <div className="password-requirement">
                            {passwordChecks.uppercase &&
                            passwordChecks.lowercase ? (
                              <span className="requirement-check">✓</span>
                            ) : (
                              <span className="requirement-dot invalid"></span>
                            )}
                            <span
                              className={`requirement-text ${
                                passwordChecks.uppercase &&
                                passwordChecks.lowercase
                                  ? "valid"
                                  : "invalid"
                              }`}
                            >
                              包含大小寫字母 (a-z, A-Z)
                            </span>
                          </div>
                          <div className="password-requirement">
                            {passwordChecks.number || passwordChecks.special ? (
                              <span className="requirement-check">✓</span>
                            ) : (
                              <span className="requirement-dot invalid"></span>
                            )}
                            <span
                              className={`requirement-text ${
                                passwordChecks.number || passwordChecks.special
                                  ? "valid"
                                  : "invalid"
                              }`}
                            >
                              包含數字 (0-9) 或特殊符號
                            </span>
                          </div>
                        </div>
                      )}
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
                      <img
                        src="https://www.google.com/favicon.ico"
                        alt="Google"
                        className="social-icon"
                      />
                      <span>使用Google註冊</span>
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
