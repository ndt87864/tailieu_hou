import React from "react";
import SheetsTab from "../../components/admin/SheetsTab.js";

const ExcelPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[var(--bg)] pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <SheetsTab />
    </div>
  );
};

export default ExcelPage;
