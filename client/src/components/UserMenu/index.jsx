import React, { useState, useRef, useEffect } from "react";
import { useClerk, useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import "../../styles/Login.css";

const UserMenu = () => {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef();

  // 處理登出
  const handleSignOut = async () => {
    try {
      await signOut();
      // 登出後重定向到登入頁
      window.location.href = "/login";
    } catch (error) {
      console.error("登出錯誤:", error);
    }
  };

  // 點擊其他地方關閉菜單
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 如果用戶數據未載入完成，顯示載入狀態
  if (!isUserLoaded) {
    return <div className="user-menu-loading">載入中...</div>;
  }

  // 如果沒有用戶，不顯示菜單
  if (!user) {
    return null;
  }

  // 獲取用戶頭像或首字母
  const userInitial =
    user.firstName?.charAt(0) ||
    user.emailAddresses[0]?.emailAddress?.charAt(0)?.toUpperCase() ||
    "U";
  const userAvatarUrl = user.imageUrl;

  return (
    <div className={`user-menu ${isOpen ? "menu-open" : ""}`} ref={menuRef}>
      <button
        className="user-menu-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="用戶菜單"
        aria-expanded={isOpen}
      >
        {userAvatarUrl ? (
          <img src={userAvatarUrl} alt="用戶頭像" className="user-avatar" />
        ) : (
          <div className="user-avatar-placeholder">{userInitial}</div>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="user-menu-overlay"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="user-menu-dropdown">
            <div className="user-menu-header">
              <div className="user-menu-info">
                <span className="user-menu-fullname">
                  {`${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                    "用戶"}
                </span>
                <span className="user-menu-email">
                  {user.primaryEmailAddress?.emailAddress || ""}
                </span>
              </div>
            </div>

            <div className="user-menu-divider"></div>

            <Link
              to="/profile"
              className="user-menu-item"
              onClick={() => setIsOpen(false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: "10px" }}
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              個人資料
            </Link>
            <Link
              to="/settings"
              className="user-menu-item"
              onClick={() => setIsOpen(false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: "10px" }}
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              設置
            </Link>

            <div className="user-menu-divider"></div>

            <button className="logout-button" onClick={handleSignOut}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: "10px" }}
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              退出登入
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UserMenu;
