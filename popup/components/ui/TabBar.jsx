function TabBar({ activeTab, onTabChange }) {
  const tabs = [
    { id: "search", label: "🔍 Search" },
    { id: "library", label: "📚 Library" },
    { id: "import", label: "📥 Import" },
    { id: "settings", label: "⚙ Settings" },
  ];

  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default TabBar;
