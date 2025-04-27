import React, { useState } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import {
  Button,
  Card,
  Avatar,
  Tabs,
  Form,
  Input,
  message,
  Spin,
  Upload,
  DatePicker,
  Modal,
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  UploadOutlined,
  SecurityScanOutlined,
  SettingOutlined,
  UserSwitchOutlined,
  CameraOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import "../styles/Profile.css";

// 側邊欄導航組件
const ProfileSidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const [showModal, setShowModal] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // 確定當前活動頁面
  const isActive = (path) => {
    if (path === "/profile" && pathname === "/profile") return true;
    if (path !== "/profile" && pathname.startsWith(path)) return true;
    return false;
  };

  // 獲取用戶名稱和頭像
  const userFullName =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || "用戶";
  const userInitial =
    user.firstName?.charAt(0) || user.lastName?.charAt(0) || "U";

  // 處理頭像上傳
  const handleAvatarUpload = async (info) => {
    if (info.file.status === "uploading") {
      setUploading(true);
      return;
    }
    if (info.file.status === "done") {
      try {
        const file = info.file.originFileObj;
        await user.setProfileImage({ file });
        messageApi.success("頭像更新成功！");
        setShowModal(false);
      } catch (error) {
        console.error("頭像上傳失敗:", error);
        messageApi.error("頭像上傳失敗，請重試");
      } finally {
        setUploading(false);
      }
    }
  };

  // 處理頭像移除
  const handleRemoveAvatar = async () => {
    try {
      await user.setProfileImage({ file: null });
      messageApi.success("頭像已移除");
      setShowModal(false);
    } catch (error) {
      messageApi.error("移除失敗，請重試");
    }
  };

  return (
    <div className="profile-sidebar">
      {contextHolder}
      <div className="profile-sidebar-header">
        <div
          className="profile-avatar-container"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{ position: "relative", cursor: "pointer" }}
          onClick={() => setShowModal(true)}
        >
          {user.imageUrl ? (
            <Avatar size={64} src={user.imageUrl} />
          ) : (
            <Avatar size={64} style={{ backgroundColor: "#8883bd" }}>
              {user.firstName?.charAt(0) || user.lastName?.charAt(0) || "U"}
            </Avatar>
          )}
          {/* 相機icon提示 */}
          {hovered && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: 6,
                transform: "translateX(-50%)",
                background: "rgba(0,0,0,0.6)",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <CameraOutlined style={{ color: "#fff", fontSize: 18 }} />
            </div>
          )}
        </div>
        <h2 className="profile-sidebar-name">{userFullName}</h2>
        <p className="profile-sidebar-email">
          {user.primaryEmailAddress?.emailAddress}
        </p>
      </div>

      <div className="profile-sidebar-title">賬戶設置</div>
      <div className="profile-nav-items">
        <Link
          to="/profile"
          className={`profile-nav-item ${isActive("/profile") ? "active" : ""}`}
        >
          <UserOutlined />
          <span>個人資料</span>
        </Link>
        <Link
          to="/profile/security"
          className={`profile-nav-item ${
            isActive("/profile/security") ? "active" : ""
          }`}
        >
          <SecurityScanOutlined />
          <span>安全設置</span>
        </Link>
        <Link
          to="/profile/account"
          className={`profile-nav-item ${
            isActive("/profile/account") ? "active" : ""
          }`}
        >
          <UserSwitchOutlined />
          <span>帳戶管理</span>
        </Link>

      </div>

      {/* Modal for 更換頭像 */}
      <Modal
        open={showModal}
        onCancel={() => setShowModal(false)}
        footer={null}
        centered
        width={340}
        bodyStyle={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: 32,
        }}
        title={null}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Avatar
            size={120}
            src={user.imageUrl}
            style={{ marginBottom: 16, backgroundColor: "#8883bd" }}
          >
            {!user.imageUrl &&
              (user.firstName?.charAt(0) || user.lastName?.charAt(0) || "U")}
          </Avatar>
          <Upload
            name="avatar"
            className="avatar-uploader"
            showUploadList={false}
            customRequest={({ file, onSuccess }) => {
              setTimeout(() => {
                onSuccess("ok");
              }, 0);
            }}
            onChange={handleAvatarUpload}
            disabled={uploading}
          >
            <Button
              icon={<CameraOutlined />}
              loading={uploading}
              style={{ width: 180, marginBottom: 12 }}
            >
              上傳新頭像
            </Button>
          </Upload>
          <Button
            icon={<DeleteOutlined />}
            danger
            style={{ width: 180, marginBottom: 12 }}
            onClick={handleRemoveAvatar}
          >
            移除頭像
          </Button>
          <Button style={{ width: 180 }} onClick={() => setShowModal(false)}>
            取消
          </Button>
        </div>
      </Modal>
    </div>
  );
};

// 個人資料表單
const ProfileForm = ({ user }) => {
  const [messageApi, contextHolder] = message.useMessage();

  // 處理個人信息表單提交
  const handleProfileSubmit = async (values) => {
    try {
      await user.update({
        firstName: values.firstName,
        lastName: values.lastName,
        birthday: values.birthday,
        school: values.school,
      });
      messageApi.success("個人資料更新成功！");
    } catch (error) {
      console.error("更新個人資料失敗:", error);
      messageApi.error("更新個人資料失敗，請重試");
    }
  };

  return (
    <div className="profile-section">
      {contextHolder}
      <div className="profile-section-header">
        <h2>個人資料</h2>
        <p>更新您的個人信息和頭像</p>
      </div>

      <Card
        className="profile-card"
        style={{ maxWidth: 500, margin: "0 auto" }}
      >
        <Form
          layout="vertical"
          initialValues={{
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            birthday: user.birthday || null,
            school: user.school || "",
            email: user.primaryEmailAddress?.emailAddress || "",
          }}
          onFinish={handleProfileSubmit}
        >
          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item
              label="名字"
              name="firstName"
              style={{ flex: 1 }}
              rules={[{ required: true, message: "請輸入您的名字" }]}
            >
              <Input prefix={<UserOutlined />} placeholder="您的名字" />
            </Form.Item>
            <Form.Item
              label="生日"
              name="birthday"
              style={{ flex: 1 }}
              rules={[{ required: true, message: "請選擇生日" }]}
            >
              <DatePicker
                style={{ width: "100%" }}
                placeholder="西元年月日"
                format="YYYY-MM-DD"
              />
            </Form.Item>
          </div>

          <Form.Item
            label="就讀學校"
            name="school"
            rules={[{ required: true, message: "請輸入學校名稱" }]}
          >
            <Input placeholder="學校名稱" />
          </Form.Item>

          <Form.Item label="電子郵件" name="email">
            <Input
              prefix={<MailOutlined />}
              placeholder="您的電子郵件"
              disabled
              style={{ backgroundColor: "#f5f5f5" }}
            />
            <div className="form-help-text">電子郵件地址不可更改</div>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: "100%" }}>
              保存更改
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

// 安全設置表單
const SecurityForm = ({ user }) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();

  // 處理密碼更新
  const handlePasswordUpdate = async (values) => {
    try {
      if (values.newPassword !== values.confirmPassword) {
        messageApi.error("兩次輸入的密碼不一致！");
        return;
      }

      // 使用Clerk API更新密碼
      await user.updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      messageApi.success("密碼更新成功！");
      form.resetFields();
    } catch (error) {
      console.error("密碼更新失敗:", error);
      messageApi.error(error.errors?.[0]?.message || "密碼更新失敗，請重試");
    }
  };

  return (
    <div className="profile-section">
      {contextHolder}
      <div className="profile-section-header">
        <h2>安全設置</h2>
        <p>更新您的密碼和安全選項</p>
      </div>

      <Card className="profile-card">
        <Form layout="vertical" form={form} onFinish={handlePasswordUpdate}>
          <Form.Item
            label="當前密碼"
            name="currentPassword"
            rules={[{ required: true, message: "請輸入當前密碼" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="當前密碼" />
          </Form.Item>

          <Form.Item
            label="新密碼"
            name="newPassword"
            rules={[
              { required: true, message: "請輸入新密碼" },
              { min: 8, message: "密碼長度至少為8個字符" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="新密碼" />
          </Form.Item>

          <Form.Item
            label="確認新密碼"
            name="confirmPassword"
            rules={[
              { required: true, message: "請確認新密碼" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("兩次輸入的密碼不一致"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="確認新密碼"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              更新密碼
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

// 帳戶管理表單
const AccountForm = () => {
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  // 處理登出
  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("登出失敗:", error);
      messageApi.error("登出失敗，請重試");
    }
  };

  return (
    <div className="profile-section">
      {contextHolder}
      <div className="profile-section-header">
        <h2>帳戶管理</h2>
        <p>管理您的帳戶設置和安全選項</p>
      </div>

      <Card className="profile-card">
        <div className="security-section">
          <div className="security-item">
            <h3>帳號登出</h3>
            <p>退出當前設備的登入狀態</p>
            <Button danger onClick={handleSignOut}>
              登出帳號
            </Button>
          </div>

          <div className="security-item">
            <h3>刪除帳號</h3>
            <p>請謹慎操作，該操作不可恢復</p>
            <Button
              danger
              type="primary"
              onClick={() => messageApi.info("請聯繫管理員以刪除帳號")}
            >
              刪除帳號
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

// 主 Profile 組件
const Profile = () => {
  const { user, isLoaded, isSignedIn } = useUser();
  const { section } = useParams();
  const navigate = useNavigate();

  // 如果用戶數據未載入完成，顯示載入狀態
  if (!isLoaded) {
    return (
      <div className="profile-loading">
        <Spin size="large" />
        <p>載入個人資料中...</p>
      </div>
    );
  }

  // 如果未登入，顯示錯誤信息
  if (!isSignedIn) {
    return (
      <div className="profile-error">
        <p>請先登入後再訪問個人資料頁面</p>
        <Button type="primary" onClick={() => navigate("/login")}>
          前往登入
        </Button>
      </div>
    );
  }

  // 根據路由參數確定要顯示的內容
  const renderContent = () => {
    switch (section) {
      case "security":
        return <SecurityForm user={user} />;
      case "account":
        return <AccountForm />;
      default:
        return <ProfileForm user={user} />;
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-content">
        <ProfileSidebar />
        <div className="profile-main">{renderContent()}</div>
      </div>
    </div>
  );
};

export default Profile;
