import React from "react";

const LoadingSpinner: React.FC<{ label?: string }> = ({ label = "Đang tải..." }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 animate-fade-in">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-[3px] border-brand-100" />
        <div className="absolute inset-0 w-10 h-10 rounded-full border-[3px] border-brand-600 border-t-transparent animate-spin" />
      </div>
      <span className="text-sm text-gray-400 font-medium">{label}</span>
    </div>
  );
};

export const SkeletonCard: React.FC = () => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse-soft">
    <div className="skeleton h-5 w-3/4 mb-3" />
    <div className="skeleton h-3 w-full mb-2" />
    <div className="skeleton h-3 w-2/3 mb-4" />
    <div className="skeleton h-9 w-full rounded-xl" />
  </div>
);

export const SkeletonRow: React.FC<{ cols?: number }> = ({ cols = 3 }) => (
  <div className="animate-pulse-soft flex items-center gap-4 px-6 py-4">
    {Array.from({ length: cols }).map((_, i) => (
      <div key={i} className="skeleton h-4 rounded-md flex-1" />
    ))}
  </div>
);

export default LoadingSpinner;