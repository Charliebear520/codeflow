import React, { useState, useEffect } from "react";
import { useAuth, useSignIn } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { Input, Button } from "antd";
import "../styles/Login.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [currentStep, setCurrentStep] = useState(1); // 1: 輸入郵件, 2: 驗證碼確認, 3: 重置密碼
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // 密碼強度檢查
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  // 密碼顯示/隱藏狀態
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();

  useEffect(() => {
    if (isSignedIn) {
      navigate("/");
    }
  }, [isSignedIn, navigate]);

  // 重新發送驗證碼冷卻計時器
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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

  if (!isLoaded) {
    return <div className="loading-container">載入中...</div>;
  }

  // 發送重設密碼驗證碼到用戶郵箱
  async function sendResetCode(e) {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn?.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setCurrentStep(2);
      setError("");
      setResendCooldown(60); // 60秒冷卻時間
    } catch (err) {
      console.error("發送驗證碼錯誤:", err);

      // 提供更友善的中文錯誤訊息
      let errorMsg = "發送驗證碼失敗，請重試";

      if (err.errors && err.errors.length > 0) {
        const error = err.errors[0];
        if (error.message) {
          if (
            error.message.includes("not found") ||
            error.message.includes("不存在")
          ) {
            errorMsg = "此電子郵件地址未註冊，請檢查郵件地址是否正確";
          } else if (
            error.message.includes("rate limit") ||
            error.message.includes("限制")
          ) {
            errorMsg = "發送請求過於頻繁，請稍後再試";
          } else {
            errorMsg = error.message;
          }
        }
      }

      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }

  // 重新發送驗證碼
  async function resendCode() {
    setIsLoading(true);
    try {
      await signIn?.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setError("");
      setResendCooldown(60); // 重新設置60秒冷卻時間
    } catch (err) {
      console.error("重新發送驗證碼錯誤:", err);

      // 提供更友善的中文錯誤訊息
      let errorMsg = "重新發送驗證碼失敗，請重試";

      if (err.errors && err.errors.length > 0) {
        const error = err.errors[0];
        if (error.message) {
          if (
            error.message.includes("rate limit") ||
            error.message.includes("限制")
          ) {
            errorMsg = "發送請求過於頻繁，請稍後再試";
          } else {
            errorMsg = error.message;
          }
        }
      }

      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }

  // 驗證碼確認
  async function verifyCode() {
    if (code.length !== 6) {
      setError("請輸入完整的6位驗證碼");
      return;
    }

    setIsLoading(true);
    try {
      console.log("驗證驗證碼:", code);

      // 真正驗證驗證碼，但不重設密碼
      const result = await signIn?.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
      });

      console.log("驗證碼驗證結果:", result);

      if (result.status === "needs_new_password") {
        // 驗證碼正確，可以進入重設密碼步驟
        setCurrentStep(3);
        setError("");
      } else {
        setError("驗證碼驗證失敗，請檢查驗證碼是否正確");
      }
    } catch (err) {
      console.error("驗證碼驗證錯誤:", err);

      let errorMsg = "驗證碼不正確，請檢查您輸入的6位數字驗證碼是否正確";

      if (err.errors && err.errors.length > 0) {
        const error = err.errors[0];
        if (error.message) {
          if (
            error.message.includes("Incorrect code") ||
            error.message.includes("incorrect")
          ) {
            errorMsg = "驗證碼不正確，請檢查您輸入的6位數字驗證碼是否正確";
          } else if (error.message.includes("expired")) {
            errorMsg = "驗證碼已過期，請重新獲取驗證碼";
          } else {
            errorMsg = error.message;
          }
        }
      } else if (err.message) {
        if (
          err.message.includes("Incorrect code") ||
          err.message.includes("incorrect")
        ) {
          errorMsg = "驗證碼不正確，請檢查您輸入的6位數字驗證碼是否正確";
        } else if (err.message.includes("expired")) {
          errorMsg = "驗證碼已過期，請重新獲取驗證碼";
        } else {
          errorMsg = err.message;
        }
      }

      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }

  // 重設密碼
  async function resetPassword(e) {
    e.preventDefault();
    setIsLoading(true);
    try {
      // 驗證碼已經在第2步驗證過了，這裡只需要重設密碼
      console.log("嘗試重設密碼，密碼長度:", password.length);
      console.log("當前 signIn 狀態:", signIn);

      // 使用 resetPassword 方法重設密碼
      const result = await signIn?.resetPassword({
        password,
      });

      console.log("重設密碼結果:", result);

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        navigate("/");
      }
    } catch (err) {
      console.error("重設密碼錯誤:", err);

      // 提供更友善的中文錯誤訊息
      let errorMsg = "重設密碼失敗，請重試";

      if (err.errors && err.errors.length > 0) {
        const error = err.errors[0];
        if (error.message) {
          if (
            error.message.includes("password") &&
            error.message.includes("weak")
          ) {
            errorMsg = "密碼強度不足，請確保密碼符合所有要求";
          } else if (
            error.message.includes("password") &&
            error.message.includes("pwned")
          ) {
            errorMsg = "此密碼安全性不足，請選擇一個全新的密碼";
          } else if (error.message.includes("expired")) {
            errorMsg = "驗證碼已過期，請重新開始密碼重設流程";
          } else {
            errorMsg = error.message;
          }
        }
      } else if (err.message) {
        // 處理沒有 errors 陣列的情況
        if (err.message.includes("expired")) {
          errorMsg = "驗證碼已過期，請重新開始密碼重設流程";
        } else {
          errorMsg = err.message;
        }
      }

      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <form onSubmit={sendResetCode} className="custom-auth-form">
            <div className="custom-form-field">
              <label htmlFor="email">請輸入您的電子郵件</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
              />
              <button
                type="submit"
                className="custom-submit-button"
                disabled={isLoading}
              >
                {isLoading ? "發送中..." : "發送重設密碼驗證碼"}
              </button>
            </div>
          </form>
        );

      case 2:
        return (
          <div className="custom-auth-form">
            <div className="custom-form-field">
              <label className="otp-label">請輸入驗證碼</label>
              <div
                style={{
                  marginBottom: "20px",
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Input.OTP
                  length={6}
                  value={code}
                  onChange={setCode}
                  formatter={(str) => {
                    // 將全形數字轉換為半形數字，並過濾非數字字符
                    return str
                      .replace(/[０-９]/g, (char) =>
                        String.fromCharCode(char.charCodeAt(0) - 0xfee0)
                      )
                      .replace(/[^0-9]/g, ""); // 只保留數字
                  }}
                  style={{ justifyContent: "center" }}
                  size="large"
                />
              </div>

              <button
                type="button"
                className="resend-code-button"
                onClick={resendCode}
                disabled={isLoading || resendCooldown > 0}
              >
                {resendCooldown > 0
                  ? `重新傳送驗證碼 (${resendCooldown}秒)`
                  : "重新傳送驗證碼"}
              </button>

              <button
                type="button"
                className="custom-submit-button"
                onClick={verifyCode}
                disabled={code.length !== 6}
              >
                下一步
              </button>

              <button
                type="button"
                className="custom-back-button"
                onClick={() => {
                  setCurrentStep(1);
                  setCode("");
                  setError("");
                }}
                disabled={isLoading}
              >
                返回上一步
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <form onSubmit={resetPassword} className="custom-auth-form">
            <div className="custom-form-field">
              <label htmlFor="password">新密碼</label>
              <div className="password-input-container">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    checkPasswordStrength(e.target.value);
                  }}
                  placeholder="輸入新密碼"
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
                    {passwordChecks.uppercase && passwordChecks.lowercase ? (
                      <span className="requirement-check">✓</span>
                    ) : (
                      <span className="requirement-dot invalid"></span>
                    )}
                    <span
                      className={`requirement-text ${
                        passwordChecks.uppercase && passwordChecks.lowercase
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
            <button
              type="submit"
              className="custom-submit-button"
              disabled={isLoading}
            >
              {isLoading ? "重設中..." : "重設密碼"}
            </button>

            <button
              type="button"
              className="custom-back-button"
              onClick={() => {
                setCurrentStep(2);
                setPassword("");
                setError("");
                setPasswordChecks({
                  length: false,
                  uppercase: false,
                  lowercase: false,
                  number: false,
                  special: false,
                });
              }}
              disabled={isLoading}
            >
              返回上一步
            </button>
          </form>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    return "忘記密碼";
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-image-section">{/* 左側圖片區域 */}</div>
        <div className="login-form-section">
          <div className="login-form-container">
            <h1 className="custom-auth-title">{getStepTitle()}</h1>

            <div className="custom-auth-container">
              {renderStepContent()}

              {error && <div className="custom-error-message">{error}</div>}

              <div className="custom-auth-footer">
                <span>返回</span>
                <a href="/login" className="custom-auth-link">
                  登入
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
