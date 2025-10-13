import { useState } from "react";
import "./Popup.css";
import TabBar from "./components/ui/TabBar";
import StatusMessage from "./components/ui/StatusMessage";
import SearchTab from "./components/tabs/SearchTab";
import LibraryTab from "./components/tabs/LibraryTab";
import ImportTab from "./components/tabs/ImportTab";
import SettingsTab from "./components/tabs/SettingsTab";
import { useAppContext } from "./context/AppContext";

function Popup() {
  const [activeTab, setActiveTab] = useState("search");
  const { status } = useAppContext();

  return (
    <main>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <StatusMessage message={status.message} type={status.type} />

      {activeTab === "search" && <SearchTab />}
      {activeTab === "library" && <LibraryTab />}
      {activeTab === "import" && <ImportTab />}
      {activeTab === "settings" && <SettingsTab />}
    </main>
  );
}

export default Popup;
