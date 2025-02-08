import React from "react";
import { Upload as AntUpload, App } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import styles from "./upload.module.css";

const Dragger = AntUpload.Dragger;

const Upload = ({ fileList, setFileList }) => {
  const { message } = App.useApp();

  const uploadProps = {
    name: "file",
    multiple: false,
    fileList,
    accept: "image/*",
    showUploadList: false,
    beforeUpload: (file) => {
      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        message.error("只能上傳圖片檔案！");
        return false;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error("圖片必須小於 10MB！");
        return false;
      }
      return false;
    },
    onChange: (info) => {
      const currentFile = info.fileList[info.fileList.length - 1];

      if (currentFile && currentFile.originFileObj) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target.result.split(",")[1];
          setFileList([
            {
              ...currentFile,
              base64,
              previewUrl: e.target.result,
            },
          ]);
        };
        reader.readAsDataURL(currentFile.originFileObj);
      }
    },
    onDrop: (e) => {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target.result.split(",")[1];
          setFileList([
            {
              uid: Date.now(),
              name: droppedFile.name,
              originFileObj: droppedFile,
              base64,
              previewUrl: e.target.result,
            },
          ]);
        };
        reader.readAsDataURL(droppedFile);
      }
    },
  };

  console.log("Current fileList:", fileList);

  return (
    <App>
      <div className={styles.container}>
        <Dragger {...uploadProps}>
          {fileList.length > 0 && fileList[0].previewUrl ? (
            <div className={styles.uploadedImageContainer}>
              <img
                src={fileList[0].previewUrl}
                alt="上傳的圖片"
                className={styles.uploadedImage}
              />
              <div className={styles.imageOverlay}>
                <p>點擊或拖曳以更換圖片</p>
              </div>
            </div>
          ) : (
            <>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">點擊或拖曳檔案到此區域上傳</p>
              <p className="ant-upload-hint">
                支援單個圖片檔案上傳，檔案大小不超過 10MB
              </p>
            </>
          )}
        </Dragger>
      </div>
    </App>
  );
};

export default Upload;
