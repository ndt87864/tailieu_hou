import React, { createContext, useContext, useState, useCallback } from "react";
import ConfirmModal from "../components/common/ConfirmModal.js";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
}

type ConfirmFunction = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | undefined>(undefined);

interface ModalState {
  show: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: "danger" | "warning" | "info";
  resolve: ((value: boolean) => void) | null;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<ModalState>({
    show: false,
    title: "Xác nhận",
    message: "",
    confirmText: "Đồng ý",
    cancelText: "Hủy",
    type: "danger",
    resolve: null,
  });

  const confirm = useCallback<ConfirmFunction>((options) => {
    return new Promise<boolean>((resolve) => {
      if (typeof options === "string") {
        setModalState({
          show: true,
          title: "Xác nhận xóa",
          message: options,
          confirmText: "Xóa",
          cancelText: "Hủy",
          type: "danger",
          resolve,
        });
      } else {
        setModalState({
          show: true,
          title: options.title || "Xác nhận",
          message: options.message,
          confirmText: options.confirmText || "Đồng ý",
          cancelText: options.cancelText || "Hủy",
          type: options.type || "danger",
          resolve,
        });
      }
    });
  }, []);

  const handleConfirm = () => {
    if (modalState.resolve) modalState.resolve(true);
    setModalState((prev) => ({ ...prev, show: false, resolve: null }));
  };

  const handleCancel = () => {
    if (modalState.resolve) modalState.resolve(false);
    setModalState((prev) => ({ ...prev, show: false, resolve: null }));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmModal
        show={modalState.show}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        type={modalState.type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmFunction => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
};
