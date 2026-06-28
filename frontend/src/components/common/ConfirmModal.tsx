import React from "react";
import { AlertTriangle, Info, AlertCircle, X } from "lucide-react";
import "../../css/confirm-modal.css";

interface ConfirmModalProps {
  show: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  show,
  title,
  message,
  confirmText,
  cancelText,
  type,
  onConfirm,
  onCancel,
}) => {
  if (!show) return null;

  const getIcon = () => {
    switch (type) {
      case "danger":
        return <AlertTriangle className="confirm-icon confirm-icon-danger" />;
      case "warning":
        return <AlertCircle className="confirm-icon confirm-icon-warning" />;
      default:
        return <Info className="confirm-icon confirm-icon-info" />;
    }
  };

  const getIconWrapperClass = () => {
    switch (type) {
      case "danger":
        return "confirm-icon-wrapper bg-red-500/10 dark:bg-red-500/20";
      case "warning":
        return "confirm-icon-wrapper bg-amber-500/10 dark:bg-amber-500/20";
      default:
        return "confirm-icon-wrapper bg-emerald-500/10 dark:bg-emerald-500/20";
    }
  };

  return (
    <div className="confirm-modal-overlay">
      <div className="confirm-modal-container">
        <button className="confirm-modal-close" onClick={onCancel}>
          <X className="confirm-close-icon" />
        </button>
        <div className="confirm-modal-body">
          <div className={getIconWrapperClass()}>{getIcon()}</div>
          <div className="confirm-content">
            <h3 className="confirm-title">{title}</h3>
            <p className="confirm-message">{message}</p>
          </div>
        </div>
        <div className="confirm-modal-actions">
          <button className="confirm-btn-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={`confirm-btn-action confirm-btn-${type}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
