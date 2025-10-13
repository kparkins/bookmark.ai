import React from "react";
import ReactDOM from "react-dom/client";
import Popup from "./Popup";
import { AppProvider } from "./context/AppContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProvider>
      <Popup />
    </AppProvider>
  </React.StrictMode>,
);
