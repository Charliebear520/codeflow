import React, { useState } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
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
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import "../styles/Profile.css";

const Profile = () => {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState("1");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [form] = Form.useForm();

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
        <Button type="primary" href="/login">
          前往登入
        </Button>
      </div>
    );
  }

  // 處理個人信息表單提交
  const handleProfileSubmit = async (values) => {
    try {
      await user.update({
        firstName: values.firstName,
        lastName: values.lastName,
      });
      messageApi.success("個人資料更新成功！");
    } catch (error) {
      console.error("更新個人資料失敗:", error);
      messageApi.error("更新個人資料失敗，請重試");
    }
  };

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

  // 處理頭像上傳
  const handleAvatarUpload = async (info) => {
    if (info.file.status === "uploading") {
      setUploadLoading(true);
      return;
    }

    if (info.file.status === "done") {
      try {
        // 獲取上傳的圖片文件
        const file = info.file.originFileObj;

        // 上傳到Clerk
        await user.setProfileImage({ file });
        messageApi.success("頭像更新成功！");
      } catch (error) {
        console.error("頭像上傳失敗:", error);
        messageApi.error("頭像上傳失敗，請重試");
      } finally {
        setUploadLoading(false);
      }
    }
  };

  // 處理登出
  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = "/login";
    } catch (error) {
      console.error("登出失敗:", error);
      messageApi.error("登出失敗，請重試");
    }
  };

  // Tab項配置
  const tabItems = [
    {
      key: "1",
      label: "個人信息",
      children: (
        <Form
          layout="vertical"
          initialValues={{
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            email: user.primaryEmailAddress?.emailAddress || "",
          }}
          onFinish={handleProfileSubmit}
        >
          <Form.Item
            label="名字"
            name="firstName"
            rules={[{ required: true, message: "請輸入您的名字" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="您的名字" />
          </Form.Item>

          <Form.Item
            label="姓氏"
            name="lastName"
            rules={[{ required: true, message: "請輸入您的姓氏" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="您的姓氏" />
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
            <Button type="primary" htmlType="submit">
              保存更改
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: "2",
      label: "修改密碼",
      children: (
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
      ),
    },
    {
      key: "3",
      label: "賬號安全",
      children: (
        <div className="security-section">
          <div className="security-item">
            <h3>賬號登出</h3>
            <p>退出當前設備的登入狀態</p>
            <Button danger onClick={handleSignOut}>
              登出賬號
            </Button>
          </div>

          <div className="security-item">
            <h3>刪除賬號</h3>
            <p>請謹慎操作，該操作不可恢復</p>
            <Button
              danger
              type="primary"
              onClick={() => messageApi.info("請聯繫管理員以刪除賬號")}
            >
              刪除賬號
            </Button>
          </div>
        </div>
      ),
    },
  ];

  const userFullName =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || "用戶";
  const userInitial =
    user.firstName?.charAt(0) || user.lastName?.charAt(0) || "U";

  return (
    <div className="profile-container">
      {contextHolder}
      <div className="profile-header">
        <h1>個人資料</h1>
      </div>

      <div className="profile-content">
        <div className="profile-sidebar">
          <Card className="profile-card">
            <div className="profile-avatar-container">
              {user.imageUrl ? (
                <Avatar size={100} src={user.imageUrl} />
              ) : (
                <Avatar size={100} style={{ backgroundColor: "#8883bd" }}>
                  {userInitial}
                </Avatar>
              )}
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
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={uploadLoading}
                  className="upload-button"
                >
                  更換頭像
                </Button>
              </Upload>
            </div>
            <h2 className="profile-name">{userFullName}</h2>
            <p className="profile-email">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </Card>
        </div>

        <div className="profile-main">
          <Card>
            <Tabs
              defaultActiveKey="1"
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabItems}
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
