import React, { useState, useRef, useEffect } from "react";
import { useClerk, useUser, useAuth } from "@clerk/clerk-react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import "../../styles/Login.css";

// Clerk logo SVG
const ClerkLogo = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M19.9831 70L40 50L60.0169 70H80L40 30L0 70H19.9831Z"
      fill="#6C47FF"
    />
    <path
      d="M19.9831 30L40 50L60.0169 30H80L40 70L0 30H19.9831Z"
      fill="black"
      fillOpacity="0.3"
    />
    <path d="M0 30H19.9832L0 49.9664V30Z" fill="#6C47FF" />
    <path d="M80 30H60.0168L80 49.9664V30Z" fill="#6C47FF" />
  </svg>
);

const UserMenu = () => {
  // Clerk Hooks
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  // State 管理
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef();
  const buttonRef = useRef();
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    right: 0,
  });

  // 處理登出
  const handleSignOut = async () => {
    try {
      await signOut();
      // 登出後重定向到登入頁
      navigate("/login");
    } catch (error) {
      console.error("登出錯誤:", error);
    }
  };

  // 計算下拉選單位置
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        right: window.innerWidth - rect.right - window.scrollX,
      });
    }
  }, [isOpen]);

  // 點擊其他地方關閉菜單
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isOpen &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target) &&
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // 處理窗口大小變化
  useEffect(() => {
    const handleResize = () => {
      if (isOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          right: window.innerWidth - rect.right - window.scrollX,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen]);

  // 如果認證或用戶數據未載入完成，顯示載入狀態
  if (!isAuthLoaded || !isUserLoaded) {
    return <div className="user-menu-loading">載入中...</div>;
  }

  // 如果未登入或沒有用戶，不顯示菜單
  if (!isSignedIn || !user) {
    return null;
  }

  // 獲取用戶頭像或首字母
  const userInitial =
    user.firstName?.charAt(0) ||
    user.emailAddresses[0]?.emailAddress?.charAt(0)?.toUpperCase() ||
    "U";
  const userAvatarUrl = user.imageUrl;

  // 渲染下拉選單
  const renderDropdown = () => {
    if (!isOpen) return null;

    const dropdown = (
      <>
        <div
          className="user-menu-overlay"
          onClick={() => setIsOpen(false)}
        ></div>
        <div
          className="user-menu-dropdown clerk-dropdown"
          ref={menuRef}
          style={{
            position: "fixed",
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
            transform: "none",
          }}
        >
          {/* 當前用戶信息 */}
          <div className="user-account-section">
            <div className="user-account-item current-account">
              {userAvatarUrl ? (
                <img
                  src={userAvatarUrl}
                  alt="用戶頭像"
                  className="account-avatar"
                />
              ) : (
                <div className="account-avatar-placeholder">{userInitial}</div>
              )}
              <div className="account-info">
                <span className="account-name">
                  {`${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                    "用戶"}
                </span>
                <span className="account-email">
                  {user.primaryEmailAddress?.emailAddress || ""}
                </span>
              </div>
            </div>
          </div>

          <div className="clerk-dropdown-divider"></div>

          {/* 管理選項 */}
          <div className="clerk-action-buttons">
            {/* 個人資料 */}
            <Link
              to="/profile"
              className="clerk-action-button"
              onClick={() => setIsOpen(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 8C9.933 8 11.5 6.433 11.5 4.5C11.5 2.567 9.933 1 8 1C6.067 1 4.5 2.567 4.5 4.5C4.5 6.433 6.067 8 8 8Z"
                  fill="currentColor"
                />
                <path
                  d="M8 9.5C4.966 9.5 2.5 11.966 2.5 15H13.5C13.5 11.966 11.034 9.5 8 9.5Z"
                  fill="currentColor"
                />
              </svg>
              <span>個人資料</span>
            </Link>

            {/* 安全設置 */}
            <Link
              to="/profile/security"
              className="clerk-action-button"
              onClick={() => setIsOpen(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M13 5.5H11.5V4C11.5 2.067 9.933 0.5 8 0.5C6.067 0.5 4.5 2.067 4.5 4V5.5H3C2.45 5.5 2 5.95 2 6.5V13.5C2 14.05 2.45 14.5 3 14.5H13C13.55 14.5 14 14.05 14 13.5V6.5C14 5.95 13.55 5.5 13 5.5ZM9.5 5.5H6.5V4C6.5 3.175 7.175 2.5 8 2.5C8.825 2.5 9.5 3.175 9.5 4V5.5Z"
                  fill="currentColor"
                />
              </svg>
              <span>安全設置</span>
            </Link>

            {/* 帳戶管理 */}
            <Link
              to="/profile/account"
              className="clerk-action-button manage-button"
              onClick={() => setIsOpen(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7.25 3.75C7.25 3.06 7.81 2.5 8.5 2.5C9.19 2.5 9.75 3.06 9.75 3.75C9.75 4.44 9.19 5 8.5 5C7.81 5 7.25 4.44 7.25 3.75Z"
                  fill="currentColor"
                />
                <path
                  d="M9.08 14H7.92C7.4 14 7 13.5 7 13C7 12.5 7.4 12 7.92 12H9.08C9.6 12 10 12.5 10 13C10 13.5 9.6 14 9.08 14Z"
                  fill="currentColor"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M11.7801 8.99613C11.5701 9.20613 11.5701 9.53613 11.7801 9.74613C11.9901 9.95613 12.3101 9.95613 12.5201 9.74613L14.7801 7.46613C14.9201 7.33613 15.0001 7.15613 15.0001 6.96613C15.0001 6.77613 14.9201 6.59613 14.7801 6.46613L12.5201 4.18613C12.3101 3.97613 11.9901 3.97613 11.7801 4.18613C11.5701 4.39613 11.5701 4.72613 11.7801 4.93613L13.0901 6.25613H9.08006C8.80006 6.25613 8.56006 6.49613 8.56006 6.77613C8.56006 7.05613 8.80006 7.29613 9.08006 7.29613H13.0901L11.7801 8.99613Z"
                  fill="currentColor"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M4.21994 9.74613C4.42994 9.53613 4.42994 9.20613 4.21994 8.99613L2.90994 7.29613H6.91994C7.19994 7.29613 7.43994 7.05613 7.43994 6.77613C7.43994 6.49613 7.19994 6.25613 6.91994 6.25613H2.90994L4.21994 4.93613C4.42994 4.72613 4.42994 4.39613 4.21994 4.18613C4.00994 3.97613 3.68994 3.97613 3.47994 4.18613L1.21994 6.46613C1.07994 6.59613 0.999939 6.77613 0.999939 6.96613C0.999939 7.15613 1.07994 7.33613 1.21994 7.46613L3.47994 9.74613C3.68994 9.95613 4.00994 9.95613 4.21994 9.74613Z"
                  fill="currentColor"
                />
              </svg>
              <span>管理帳戶</span>
            </Link>


            <div
              className="clerk-dropdown-divider"
              style={{ margin: "8px 0" }}
            ></div>

            {/* 退出登入 */}
            <button
              className="clerk-action-button signout-button"
              onClick={handleSignOut}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M13 14H9C8.45 14 8 13.55 8 13C8 12.45 8.45 12 9 12H13C13.55 12 14 11.55 14 11V5C14 4.45 13.55 4 13 4H9C8.45 4 8 3.55 8 3C8 2.45 8.45 2 9 2H13C14.66 2 16 3.34 16 5V11C16 12.66 14.66 14 13 14Z"
                  fill="currentColor"
                />
                <path
                  d="M10.66 11.66C10.47 11.66 10.28 11.59 10.13 11.44C9.84 11.15 9.84 10.68 10.13 10.39L11.51 9H4C3.59 9 3.25 8.66 3.25 8.25C3.25 7.84 3.59 7.5 4 7.5H11.51L10.13 6.11C9.84 5.82 9.84 5.35 10.13 5.06C10.42 4.77 10.89 4.77 11.18 5.06L13.53 7.42C13.68 7.57 13.75 7.77 13.75 7.97C13.75 8.17 13.68 8.37 13.53 8.52L11.18 10.88C11.04 11.57 10.85 11.66 10.66 11.66Z"
                  fill="currentColor"
                />
              </svg>
              <span>登出</span>
            </button>
          </div>

          {/* Clerk 品牌標記 */}
          <div className="clerk-brand-footer">
            <span>Secured by</span>
            <ClerkLogo />
            <span>clerk</span>
          </div>
        </div>
      </>
    );

    return createPortal(dropdown, document.body);
  };

  return (
    <div className={`user-menu ${isOpen ? "menu-open" : ""}`}>
      <button
        ref={buttonRef}
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
      {renderDropdown()}
    </div>
  );
};

export default UserMenu;
