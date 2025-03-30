import React from "react";
import { SignUp as ClerkSignUp } from "@clerk/clerk-react";
import "../styles/Login.css"; // 共用登入頁面的樣式

function SignUpPage() {
  // 自定義 Clerk 組件的外觀
  const appearance = {
    layout: {
      socialButtonsVariant: "blockButton",
      socialButtonsPlacement: "bottom",
      showOptionalFields: true,
      logoPlacement: "none",
      termsPageUrl: "https://clerk.com/terms",
      privacyPageUrl: "https://clerk.com/privacy",
    },
    variables: {
      borderRadius: "8px",
      colorBackground: "#ffffff",
      colorPrimary: "#8883bd",
      colorText: "#1e1e1e",
      colorTextSecondary: "#4d4d4d",
      colorDanger: "#e53935",
      colorSuccess: "#4caf50",
      fontFamily: "Arial, sans-serif",
      fontSize: "16px",
      fontWeight: {
        normal: "400",
        medium: "500",
        bold: "600",
      },
      spacingUnit: "4px",
    },
    elements: {
      rootBox: {
        boxShadow: "none",
        width: "100%",
        maxWidth: "100%",
        margin: 0,
        padding: 0,
        backgroundColor: "transparent",
      },
      card: {
        boxShadow: "none",
        border: "1px solid #d9d9d9",
        borderRadius: "8px",
        width: "100%",
        maxWidth: "100%",
        margin: 0,
        padding: "20px",
        backgroundColor: "#ffffff",
      },
      header: {
        fontSize: "28px",
        fontWeight: "600",
        color: "#000",
        textAlign: "center",
        width: "100%",
        margin: "0 0 20px 0",
        padding: "0 10px",
      },
      formButtonPrimary: {
        backgroundColor: "#8883bd",
        "&:hover": {
          backgroundColor: "#7671a9",
        },
        fontSize: "14px",
        width: "100%",
        padding: "8px 16px",
        margin: "10px 0",
        boxShadow: "none",
        borderRadius: "8px",
        border: "none",
        outline: "none",
        height: "40px",
      },
      formFieldLabel: {
        fontSize: "14px",
        color: "#1e1e1e",
        fontWeight: "500",
        margin: "5px 0",
        padding: "0 2px",
      },
      formFieldInput: {
        borderRadius: "8px",
        border: "1px solid #d9d9d9",
        fontSize: "14px",
        width: "90%",
        padding: "8px 16px",
        margin: "5px",
        boxShadow: "none",
        height: "40px",
        boxSizing: "border-box",
        backgroundColor: "#ffffff",
        color: "#1e1e1e",
        outline: "none",
        "&:focus": {
          border: "1px solid #8883bd",
          boxShadow: "none",
        },
      },
      footerActionText: {
        fontSize: "14px",
        color: "#1e1e1e",
        margin: "10px 0",
        padding: "5px 0",
      },
      footerActionLink: {
        color: "#3759d3",
        fontWeight: "500",
        textDecoration: "none",
        "&:hover": {
          textDecoration: "underline",
        },
      },
      identityPreview: {
        borderRadius: "8px",
        width: "0%",
        margin: "10px",
        padding: "10px",
        border: "1px solid transparent",
      },
      socialButtonsBlockButton: {
        width: "100%",
        maxWidth: "100%",
        margin: "5px 0",
        padding: "8px 16px",
        boxShadow: "none",
        borderRadius: "8px",
        border: "1px solid #d9d9d9",
        backgroundColor: "#ffffff",
        color: "#1e1e1e",
        height: "40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&:hover": {
          backgroundColor: "#f2f2f2",
        },
      },
      socialButtonsProviderIcon: {
        width: "20px",
        height: "20px",
        padding: "0",
        margin: "0 12px 0 0",
      },
      socialButtonsBlockButtonText: {
        fontSize: "14px",
        fontWeight: "500",
      },
      formFieldAction: {
        color: "#3759d3",
        fontWeight: "500",
        textDecoration: "none",
        "&:hover": {
          textDecoration: "underline",
        },
      },
      alert: {
        borderRadius: "8px",
        fontSize: "14px",
        width: "100%",
        margin: "10px 0",
        padding: "10px",
        border: "1px solid #e53935",
        backgroundColor: "rgba(229, 57, 53, 0.1)",
        color: "#e53935",
      },
      form: {
        width: "100%",
        maxWidth: "100%",
        padding: "0",
        margin: "0",
      },
      formFieldRow: {
        width: "100%",
        margin: "10px 0",
        padding: "0",
      },
      main: {
        width: "100%",
        maxWidth: "100%",
        padding: "0",
        margin: "0 auto",
      },
      formFieldInputShowPasswordButton: {
        boxShadow: "none",
        border: "none",
        background: "transparent",
        padding: "0 10px",
        margin: "0",
      },
      dividerLine: {
        margin: "15px 0",
        width: "100%",
        height: "1px",
        backgroundColor: "#d9d9d9",
      },
      dividerText: {
        margin: "0 10px",
        color: "#4d4d4d",
        fontSize: "14px",
      },
      socialButtonsProviderList: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "100%",
      },
    },
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-image-section">{/* 左側圖片區域 */}</div>
        <div className="login-form-section">
          <div className="login-form-container">
            <ClerkSignUp
              appearance={appearance}
              signInUrl="/login"
              redirectUrl="/"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;
