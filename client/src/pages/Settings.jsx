import React, { useState } from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import {
  Card,
  Tabs,
  Switch,
  Radio,
  Select,
  Button,
  Divider,
  Form,
  Input,
  message,
  Spin,
} from "antd";
import {
  BellOutlined,
  LockOutlined,
  EyeOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import "../styles/Settings.css";

const { Option } = Select;

const Settings = () => {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState("1");

  // 應用設置狀態
  const [settings, setSettings] = useState({
    theme: "light",
    language: "zh_TW",
    notifications: {
      email: true,
      browser: true,
      updates: true,
      newsletter: false,
    },
    privacy: {
      twoFactorAuth: false,
      showOnlineStatus: true,
      showLastSeen: true,
      publicProfile: true,
    },
  });

  // 如果數據未載入完成，顯示載入狀態
  if (!isUserLoaded || !isAuthLoaded) {
    return (
      <div className="settings-loading">
        <Spin size="large" />
        <p>載入設置中...</p>
      </div>
    );
  }

  // 如果未登入，顯示錯誤信息
  if (!isSignedIn) {
    return (
      <div className="settings-error">
        <p>請先登入後再訪問設置頁面</p>
        <Button type="primary" href="/login">
          前往登入
        </Button>
      </div>
    );
  }

  // 處理通知設置更改
  const handleNotificationChange = (key, value) => {
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: value,
      },
    });
    messageApi.success(`${key}通知設置已更新`);
  };

  // 處理隱私設置更改
  const handlePrivacyChange = (key, value) => {
    setSettings({
      ...settings,
      privacy: {
        ...settings.privacy,
        [key]: value,
      },
    });
    messageApi.success(`${key}隱私設置已更新`);
  };

  // 處理語言更改
  const handleLanguageChange = (value) => {
    setSettings({
      ...settings,
      language: value,
    });
    messageApi.success("語言設置已更新");
  };

  // 處理主題更改
  const handleThemeChange = (e) => {
    setSettings({
      ...settings,
      theme: e.target.value,
    });
    messageApi.success("主題設置已更新");
  };

  // 處理雙因素認證設置
  const handleTwoFactorAuth = async (checked) => {
    try {
      if (checked) {
        // 在實際應用中，這裡應該與Clerk API交互，啟用雙因素認證
        messageApi.info("正在啟用雙因素認證，請按照提示操作");
      } else {
        // 禁用雙因素認證
        messageApi.info("已禁用雙因素認證");
      }

      setSettings({
        ...settings,
        privacy: {
          ...settings.privacy,
          twoFactorAuth: checked,
        },
      });
    } catch (error) {
      console.error("雙因素認證設置失敗:", error);
      messageApi.error("雙因素認證設置失敗，請重試");
    }
  };

  // 處理會話管理
  const handleManageSessions = () => {
    // 在實際應用中，這裡應該跳轉到Clerk的會話管理頁面
    messageApi.info("此功能將在未來版本中提供");
  };

  // Tab項配置
  const tabItems = [
    {
      key: "1",
      label: (
        <span>
          <BellOutlined />
          通知設置
        </span>
      ),
      children: (
        <div className="settings-section">
          <div className="settings-item">
            <div className="settings-item-info">
              <h3>電子郵件通知</h3>
              <p>接收關於賬戶活動的電子郵件</p>
            </div>
            <Switch
              checked={settings.notifications.email}
              onChange={(checked) => handleNotificationChange("email", checked)}
            />
          </div>

          <Divider />

          <div className="settings-item">
            <div className="settings-item-info">
              <h3>瀏覽器通知</h3>
              <p>允許在瀏覽器中顯示通知</p>
            </div>
            <Switch
              checked={settings.notifications.browser}
              onChange={(checked) =>
                handleNotificationChange("browser", checked)
              }
            />
          </div>

          <Divider />

          <div className="settings-item">
            <div className="settings-item-info">
              <h3>產品更新通知</h3>
              <p>接收產品更新和新功能通知</p>
            </div>
            <Switch
              checked={settings.notifications.updates}
              onChange={(checked) =>
                handleNotificationChange("updates", checked)
              }
            />
          </div>

          <Divider />

          <div className="settings-item">
            <div className="settings-item-info">
              <h3>訂閱電子報</h3>
              <p>定期接收產品資訊和優惠信息</p>
            </div>
            <Switch
              checked={settings.notifications.newsletter}
              onChange={(checked) =>
                handleNotificationChange("newsletter", checked)
              }
            />
          </div>
        </div>
      ),
    },
    {
      key: "2",
      label: (
        <span>
          <LockOutlined />
          安全與隱私
        </span>
      ),
      children: (
        <div className="settings-section">
          <div className="settings-item">
            <div className="settings-item-info">
              <h3>雙因素認證</h3>
              <p>使用雙重驗證提高賬戶安全性</p>
            </div>
            <Switch
              checked={settings.privacy.twoFactorAuth}
              onChange={handleTwoFactorAuth}
            />
          </div>

          <Divider />

          <div className="settings-item">
            <div className="settings-item-info">
              <h3>顯示在線狀態</h3>
              <p>允許其他用戶查看您的在線狀態</p>
            </div>
            <Switch
              checked={settings.privacy.showOnlineStatus}
              onChange={(checked) =>
                handlePrivacyChange("showOnlineStatus", checked)
              }
            />
          </div>

          <Divider />

          <div className="settings-item">
            <div className="settings-item-info">
              <h3>顯示最後在線時間</h3>
              <p>允許其他用戶查看您最後在線的時間</p>
            </div>
            <Switch
              checked={settings.privacy.showLastSeen}
              onChange={(checked) =>
                handlePrivacyChange("showLastSeen", checked)
              }
            />
          </div>

          <Divider />

          <div className="settings-item">
            <div className="settings-item-info">
              <h3>公開個人資料</h3>
              <p>允許非註冊用戶查看您的基本資料</p>
            </div>
            <Switch
              checked={settings.privacy.publicProfile}
              onChange={(checked) =>
                handlePrivacyChange("publicProfile", checked)
              }
            />
          </div>

          <Divider />

          <div className="settings-item security-actions">
            <Button type="primary" onClick={handleManageSessions}>
              管理登入會話
            </Button>
            <p className="help-text">查看並管理當前所有登入設備</p>
          </div>
        </div>
      ),
    },
    {
      key: "3",
      label: (
        <span>
          <EyeOutlined />
          界面設置
        </span>
      ),
      children: (
        <div className="settings-section">
          <div className="settings-item theme-selection">
            <h3>主題設置</h3>
            <Radio.Group
              value={settings.theme}
              onChange={handleThemeChange}
              className="theme-options"
            >
              <Radio.Button value="light">淺色</Radio.Button>
              <Radio.Button value="dark">深色</Radio.Button>
              <Radio.Button value="system">跟隨系統</Radio.Button>
            </Radio.Group>
          </div>

          <Divider />

          <div className="settings-item">
            <h3>文字大小</h3>
            <div className="font-size-controls">
              <div className="font-size-slider">
                <span className="font-size-label small">小</span>
                <Radio.Group defaultValue="medium">
                  <Radio.Button value="small">小</Radio.Button>
                  <Radio.Button value="medium">中</Radio.Button>
                  <Radio.Button value="large">大</Radio.Button>
                </Radio.Group>
                <span className="font-size-label large">大</span>
              </div>
              <p className="preview-text">文字大小預覽</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "4",
      label: (
        <span>
          <GlobalOutlined />
          語言和區域
        </span>
      ),
      children: (
        <div className="settings-section">
          <div className="settings-item">
            <h3>語言設置</h3>
            <Select
              value={settings.language}
              style={{ width: 200 }}
              onChange={handleLanguageChange}
            >
              <Option value="zh_TW">繁體中文</Option>
              <Option value="zh_CN">簡體中文</Option>
              <Option value="en_US">English (US)</Option>
              <Option value="ja_JP">日本語</Option>
              <Option value="ko_KR">한국어</Option>
            </Select>
          </div>

          <Divider />

          <div className="settings-item">
            <h3>時區設置</h3>
            <Select defaultValue="Asia/Shanghai" style={{ width: 300 }}>
              <Option value="Asia/Shanghai">(GMT+8) 中國標準時間 - 北京</Option>
              <Option value="Asia/Taipei">(GMT+8) 台北</Option>
              <Option value="Asia/Tokyo">(GMT+9) 東京</Option>
              <Option value="America/New_York">(GMT-5) 紐約</Option>
              <Option value="Europe/London">(GMT+0) 倫敦</Option>
            </Select>
          </div>

          <Divider />

          <div className="settings-item">
            <h3>日期格式</h3>
            <Radio.Group defaultValue="YYYY-MM-DD">
              <Radio value="YYYY-MM-DD">2023-01-31</Radio>
              <Radio value="MM/DD/YYYY">01/31/2023</Radio>
              <Radio value="DD/MM/YYYY">31/01/2023</Radio>
            </Radio.Group>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="settings-container">
      {contextHolder}
      <div className="settings-header">
        <h1>應用設置</h1>
      </div>

      <div className="settings-content">
        <Card className="settings-card">
          <Tabs
            defaultActiveKey="1"
            activeKey={activeTab}
            onChange={setActiveTab}
            tabPosition="left"
            items={tabItems}
            className="settings-tabs"
          />
        </Card>
      </div>
    </div>
  );
};

export default Settings;
