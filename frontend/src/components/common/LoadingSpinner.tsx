import React from "react";

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-7 h-7 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <span className="ml-3 text-gray-500 text-sm">Đang tải...</span>
    </div>
  );
};

export default LoadingSpinner;
