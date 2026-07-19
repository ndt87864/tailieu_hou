import { Button } from "@/shared/components";

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[420px] rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-10 px-4 text-slate-600 hover:bg-slate-50"
            onClick={onCancel}
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            className="h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl"
            onClick={onConfirm}
          >
            Đồng ý
          </Button>
        </div>
      </div>
    </div>
  );
}
