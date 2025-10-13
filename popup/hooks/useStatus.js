import { useState } from "react";

export function useStatus() {
  const [status, setStatus] = useState({ message: "", type: "" });

  const showStatus = (message, type) => {
    setStatus({ message, type });

    if (type === "success") {
      setTimeout(() => {
        setStatus({ message: "", type: "" });
      }, 3000);
    }
  };

  const clearStatus = () => {
    setStatus({ message: "", type: "" });
  };

  return {
    status,
    showStatus,
    clearStatus,
  };
}
