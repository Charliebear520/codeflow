import React from "react";
import { useNavigate } from "react-router-dom";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import styles from "./stageSwitcher.module.css";

const steps = [1, 2, 3];

export default function StageSwitcher({ current, onChange }) {
  const navigate = useNavigate();

  const handleChange = (idx) => {
    onChange && onChange(idx);
    if (idx === 0) navigate("/");
    else if (idx === 1) navigate("/stage2");
    else if (idx === 2) navigate("/stage3");
  };

  return (
    <div className={styles["stage-switcher-container"]}>
      <button
        className={`${styles["nav-button"]} ${
          current === 0 ? styles.disabled : ""
        }`}
        disabled={current === 0}
        onClick={() => handleChange(current - 1)}
      >
        <LeftOutlined />
      </button>

      <div className={styles["steps-container"]}>
        {steps.map((num, idx) => (
          <React.Fragment key={idx}>
            <button
              className={`${styles["step-button"]} ${
                idx === current ? styles.active : ""
              }`}
              onClick={() => handleChange(idx)}
            >
              <span className={styles["step-number"]}>{num}</span>
            </button>
            {idx < steps.length - 1 && (
              <div
                className={`${styles["step-connector"]} ${
                  idx < current ? styles.active : ""
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <button
        className={`${styles["nav-button"]} ${
          current === steps.length - 1 ? styles.disabled : ""
        }`}
        disabled={current === steps.length - 1}
        onClick={() => handleChange(current + 1)}
      >
        <RightOutlined />
      </button>
    </div>
  );
}
