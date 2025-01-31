import React from "react";
import { Link } from "react-router-dom";
import styles from "./tutor.module.css";

const AI = () => {
  return (
    <div className={styles.container}>
      This is AI taliking section.
      <Link to="/">Back to Home page.</Link>
    </div>
  );
};

export default AI;
