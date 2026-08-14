import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState } from "react";
import { Workbook, WorkbookInstance } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { locale } from "@fortune-sheet/core";
import { viLocale } from "./viLocale";

// Patch the English locale object with our Vietnamese translations
const enObj = locale({ lang: "en" } as any);
Object.keys(viLocale).forEach((key) => {
  if ((enObj as any)[key]) {
    Object.assign((enObj as any)[key], viLocale[key]);
  }
});

export interface FortuneSheetWrapperProps {
  initialData: any[]; // The formatted data for fortune-sheet
  onChange?: (data: any[]) => void;
  onSave?: (data: any[]) => void;
}

export interface FortuneSheetRef {
  getData: () => any[];
}

const FortuneSheetWrapper = forwardRef<FortuneSheetRef, FortuneSheetWrapperProps>(
  ({ initialData, onChange, onSave }, ref) => {
    const workbookRef = useRef<WorkbookInstance>(null);
    const [data, setData] = useState<any[]>(initialData);

    useEffect(() => {
      setData(initialData);
    }, [initialData]);

    // Provide a way for the parent to trigger save and get the latest data
    useImperativeHandle(ref, () => ({
      getData: () => {
        if (workbookRef.current) {
          return workbookRef.current.getAllSheets();
        }
        return data;
      },
      setData: (newData: any[]) => {
        setData(newData);
      }
    }));

    // Optional: if the parent wants to auto-save, we can hook into onChange
    // Note: Fortune Sheet triggers onChange frequently (on cell edit, formatting change, etc.)
    const handleChange = (newData: any[]) => {
      setData(newData);
      if (onChange) {
        onChange(newData);
      }
    };

    return (
      <div style={{ width: "100%", height: "100%", minHeight: "600px", position: "relative" }}>
        <Workbook
          ref={workbookRef}
          data={data}
          onChange={handleChange}
          lang="en" // Keep it english or vietnamese depending on the library support
          devicePixelRatio={Math.max(window.devicePixelRatio || 1, 2.5)}
        />
      </div>
    );
  }
);

export default FortuneSheetWrapper;
