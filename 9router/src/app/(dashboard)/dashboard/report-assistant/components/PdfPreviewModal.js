import { Button } from "@/shared/components";

export function PdfPreviewModal({ isOpen, title, fileUrl, onClose }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-9 p-0 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-xl"
            onClick={onClose}
          >
            ✕
          </Button>
        </div>
        <div className="flex-1 bg-slate-100">
          {fileUrl ? (
            <iframe
              src={`${fileUrl}#toolbar=0`}
              className="h-full w-full border-0"
              title="PDF Preview"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              Không có tệp xem trước
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
