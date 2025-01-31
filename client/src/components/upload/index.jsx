import React, { useRef, useState } from "react";
import styles from "./upload.module.css";
import { IKContext, IKImage, IKUpload } from "imagekitio-react";

const urlEndpoint = import.meta.env.VITE_IMAGE_KIT_ENDPOINT;
const publicKey = import.meta.env.VITE_IMAGE_KIT_PUBLIC_KEY;

const authenticator = async () => {
  try {
    const response = await fetch("http://localhost:3000/api/upload");

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Request failed with status ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();
    const { signature, expire, token } = data;
    return { signature, expire, token };
  } catch (error) {
    throw new Error(`Authentication request failed: ${error.message}`);
  }
};

const Upload = ({ img, setImg }) => {
  const ikUploadRef = useRef(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isUploaded, setIsUploaded] = useState(false);

  const onError = (err) => {
    console.log("Error", err);
  };

  const onSuccess = (res) => {
    console.log("Success", res);
    setImg((prev) => ({ ...prev, isLoading: false, dbData: res }));
    setUploadedImage(res.url);
    setIsUploaded(true);
  };

  const onUploadProgress = (progress) => {
    console.log("Progress", progress);
  };

  const onUploadStart = (evt) => {
    console.log("Start", evt);
    setImg((prev) => ({
      ...prev,
      isLoading: true,
    }));
  };

  return (
    <div className={styles.container}>
      <IKContext
        publicKey={publicKey}
        urlEndpoint={urlEndpoint}
        authenticator={authenticator}
      >
        <IKUpload
          fileName="test-upload.png"
          onError={onError}
          onSuccess={onSuccess}
          useUniqueFileName={true}
          onUploadProgress={onUploadProgress}
          onUploadStart={onUploadStart}
          style={{ display: "none" }}
          ref={ikUploadRef}
        />
        <label onClick={() => ikUploadRef.current.click()}>
          {!isUploaded ? (
            <>
              <p>Upload an image</p>
              <img src="/attachment.png" alt="" />
            </>
          ) : null}
        </label>
      </IKContext>

      {isUploaded && uploadedImage && (
        <div>
          <h3>Uploaded Image:</h3>
          {img.isLoading && <div className="">Loading...</div>}
          {img.dbData?.filePath && (
            <IKImage
              urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
              path={img.dbData?.filePath}
              width="380"
              transformation={[{ width: 380 }]}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Upload;
