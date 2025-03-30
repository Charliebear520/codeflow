import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { App as AntApp } from "antd";
import { store } from "./redux/store";
import App from "./App";
import "./index.css";
import { ClerkProvider } from '@clerk/clerk-react'

// Import your Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Add your Clerk Publishable Key to the .env file')
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <Provider store={store}>
        <AntApp>
          <App />
        </AntApp>
      </Provider>
    </ClerkProvider>
  </React.StrictMode>
);
