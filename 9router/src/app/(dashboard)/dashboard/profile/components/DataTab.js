"use client";

import { useRef } from "react";
import { Card, Button, Input } from "@/shared/components";
import Modal from "@/shared/components/Modal";

export default function DataTab({
  dbLoading,
  dbStatus,
  dbAuth,
  setDbAuth,
  handleDbAuthConfirm,
  handleImportDatabase,
}) {
  const importFileRef = useRef(null);

  return (
    <div className="flex flex-col gap-6">
      {/* Database Management Card */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 sm:size-12 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">database</span>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold">Lưu trữ & Sao lưu dữ liệu</h2>
            <p className="text-sm text-text-muted">Quản lý file cơ sở dữ liệu SQLite và khôi phục hệ thống</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-2 border-t border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-xl bg-bg border border-border gap-2">
            <div>
              <p className="font-semibold text-sm sm:text-base text-text-main">Đường dẫn tệp cơ sở dữ liệu</p>
              <p className="text-xs sm:text-sm text-text-muted font-mono break-all mt-0.5">~/.9router/db/data.sqlite</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="secondary"
              icon="download"
              onClick={() => setDbAuth({ open: true, mode: "export", password: "" })}
              loading={dbLoading}
              className="w-full sm:w-auto font-medium"
            >
              Tải bản sao lưu (.json)
            </Button>
            <Button
              variant="outline"
              icon="upload"
              onClick={() => importFileRef.current?.click()}
              disabled={dbLoading}
              className="w-full sm:w-auto font-medium"
            >
              Khôi phục dữ liệu từ file
            </Button>
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportDatabase}
            />
          </div>

          {dbStatus.message && (
            <p className={`text-sm mt-1 font-medium ${dbStatus.type === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
              {dbStatus.message}
            </p>
          )}
        </div>
      </Card>

      {/* Password Modal for DB Backup Export/Import */}
      <Modal
        isOpen={dbAuth.open}
        onClose={() => setDbAuth({ open: false, mode: "", password: "" })}
        title="Xác nhận mật khẩu an toàn"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDbAuth({ open: false, mode: "", password: "" })} disabled={dbLoading}>
              Hủy bỏ
            </Button>
            <Button variant="primary" onClick={handleDbAuthConfirm} loading={dbLoading} disabled={!dbAuth.password}>
              Xác nhận thực hiện
            </Button>
          </>
        }
      >
        <p className="text-text-muted mb-3 text-sm leading-relaxed">
          Vui lòng nhập mật khẩu quản trị để thực hiện thao tác <strong className="text-text-main">{dbAuth.mode === "export" ? "xuất bản sao lưu" : "khôi phục dữ liệu"}</strong>.
        </p>
        <Input
          type="password"
          value={dbAuth.password}
          onChange={(e) => setDbAuth((s) => ({ ...s, password: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter" && dbAuth.password) handleDbAuthConfirm(); }}
          placeholder="Mật khẩu quản trị hiện tại"
          autoFocus
        />
      </Modal>
    </div>
  );
}
