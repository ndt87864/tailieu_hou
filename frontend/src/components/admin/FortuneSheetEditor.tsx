import React, { useRef, useState, useMemo } from "react";
import { SpreadsheetHeader } from "./SpreadsheetHeader";
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
      <SpreadsheetHeader
        title={title}
        setTitle={setTitle}
        isStarred={isStarred}
        setIsStarred={setIsStarred}
        isSaving={isSaving}
        onBack={onBack}
        onSave={handleSave}
      />
      <div className="flex-1 overflow-hidden relative">
        <FortuneSheetWrapper ref={sheetRef} initialData={fortuneData} />
      </div>
    </div>
  );
};
