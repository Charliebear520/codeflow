import React, { useState, useEffect } from "react";
import { useAuth, useSignIn } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [successfulCreation, setSuccessfulCreation] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();

  useEffect(() => {
    if (isSignedIn) {
      navigate("/");
    }
  }, [isSignedIn, navigate]);

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
      setSuccessfulCreation(true);
      setError("");
    } catch (err) {
      console.error("error", err.errors[0].longMessage);
      setError(err.errors[0].longMessage);
    } finally {
      setIsLoading(false);
    }
  }

  // 重設密碼
  async function resetPassword(e) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await signIn?.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        navigate("/");
      }
    } catch (err) {
      console.error("error", err.errors[0].longMessage);
      setError(err.errors[0].longMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-image-section">{/* 左側圖片區域 */}</div>
        <div className="login-form-section">
          <div className="login-form-container">
            <div className="custom-auth-container">
              <h1 className="custom-auth-title">忘記密碼</h1>

              <form
                onSubmit={!successfulCreation ? sendResetCode : resetPassword}
                className="custom-auth-form"
              >
                {!successfulCreation ? (
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
                    <button
                      type="submit"
                      className="custom-submit-button"
                      disabled={isLoading}
                    >
                      {isLoading ? "發送中..." : "發送重設密碼驗證碼"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="custom-form-field">
                      <label htmlFor="code">驗證碼</label>
                      <input
                        id="code"
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="輸入驗證碼"
                        required
                      />
                    </div>
                    <div className="custom-form-field">
                      <label htmlFor="password">新密碼</label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="輸入新密碼"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="custom-submit-button"
                      disabled={isLoading}
                    >
                      {isLoading ? "重設中..." : "重設密碼"}
                    </button>
                  </>
                )}

                {error && <div className="custom-error-message">{error}</div>}
              </form>

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
