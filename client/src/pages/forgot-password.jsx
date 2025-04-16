import React, { useState, useEffect } from "react";
import { useAuth, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [successfulCreation, setSuccessfulCreation] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();

  useEffect(() => {
    if (isSignedIn) {
      router.push("/");
    }
  }, [isSignedIn, router]);

  if (!isLoaded) {
    return null;
  }

  // 發送重設密碼驗證碼到用戶郵箱
  async function sendResetCode(e) {
    e.preventDefault();
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
    }
  }

  // 重設密碼
  async function resetPassword(e) {
    e.preventDefault();
    try {
      const result = await signIn?.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });

      if (result.status === "complete") {
        setActive({ session: result.createdSessionId });
        router.push("/"); // 重設成功後跳轉到首頁
      }
    } catch (err) {
      console.error("error", err.errors[0].longMessage);
      setError(err.errors[0].longMessage);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-center text-3xl font-bold text-gray-900">
          忘記密碼
        </h2>

        <form
          onSubmit={!successfulCreation ? sendResetCode : resetPassword}
          className="mt-8 space-y-6"
        >
          {!successfulCreation ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  請輸入您的電子郵件
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="例如：example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                發送重設密碼驗證碼
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-gray-700"
                >
                  請輸入驗證碼
                </label>
                <input
                  type="text"
                  id="code"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  請輸入新密碼
                </label>
                <input
                  type="password"
                  id="password"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                重設密碼
              </button>
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
