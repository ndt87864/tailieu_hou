import React, { useRef, useState, useMemo } from "react";
import { ArrowLeft, Star, Save } from "lucide-react";
import FortuneSheetWrapper, { FortuneSheetRef } from "./FortuneSheetWrapper";
import { convertOldSheetsToFortune, isFortuneSheetData } from "../../utils/fortuneSheetAdapter";

interface FortuneSheetEditorProps {
  sheetId: string;
  initialTitle: string;
  initialContent: any;
  onBack: () => void;
  onSave: (title: string, content: any) => Promise<void>;
}

export const FortuneSheetEditor: React.FC<FortuneSheetEditorProps> = ({
  sheetId,
  initialTitle,
  initialContent,
  onBack,
  onSave,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [isStarred, setIsStarred] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const sheetRef = useRef<FortuneSheetRef>(null);

  // Normalize data for Fortune Sheet
  const fortuneData = useMemo(() => {
    if (!initialContent) return [{ name: "Sheet1", celldata: [] }];
    
    // Check if it's already in fortune format
    if (isFortuneSheetData(initialContent)) {
      if (Array.isArray(initialContent)) {
        return initialContent;
      }
      if (initialContent.sheets && Array.isArray(initialContent.sheets)) {
        return initialContent.sheets;
      }
    }
    
    // It's the old format, convert it
    if (initialContent.sheets && Array.isArray(initialContent.sheets)) {
      return convertOldSheetsToFortune(initialContent.sheets);
    }
    
    // Fallback
    return [{ name: "Sheet1", celldata: [] }];
  }, [initialContent]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let currentData = fortuneData;
      if (sheetRef.current) {
        currentData = sheetRef.current.getData();
      }
      await onSave(title, { sheets: currentData });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-1)]">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[var(--bg-2)] transition-colors" title="Quay lại">
          <ArrowLeft className="w-4 h-4 text-[var(--fg-2)]" />
        </button>
        <input
          type="text"
          className="flex-1 bg-transparent text-sm font-medium text-[var(--fg-1)] outline-none px-2 py-1 rounded-lg hover:bg-[var(--bg-2)] focus:bg-[var(--bg-2)]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Trang tính chưa có tên"
        />
        <button
          className={`p-1.5 rounded-lg transition-colors ${isStarred ? "text-amber-400" : "text-[var(--fg-3)] hover:bg-[var(--bg-2)]"}`}
          onClick={() => setIsStarred(!isStarred)}
          title={isStarred ? "Bỏ gắn dấu sao" : "Gắn dấu sao"}
        >
          <Star className={`w-4 h-4 ${isStarred ? "fill-amber-400" : ""}`} />
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold transition-all disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? "Đang lưu..." : "Lưu lại"}
        </button>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <FortuneSheetWrapper ref={sheetRef} initialData={fortuneData} />
      </div>
    </div>
  );
};
