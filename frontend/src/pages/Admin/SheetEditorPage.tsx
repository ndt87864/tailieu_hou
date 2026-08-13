import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../../services/client";
import { useUI } from "../../context/UIContext";
import { toast } from "react-toastify";
import { FortuneSheetEditor } from "../../components/admin/FortuneSheetEditor";

const SheetEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setPageLoading } = useUI();
  
  const [loading, setLoading] = useState(true);
  const [sheetData, setSheetData] = useState<any | null>(null);

  const fetchSheetDetail = async () => {
    if (!id) return;
    setPageLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/spreadsheets/${id}`);
      setSheetData(res.data.data);
      setLoading(false);
    } catch (err: any) {
      toast.error("Không thể tải thông tin trang tính: " + (err.response?.data?.error || err.message));
      navigate("/admin/sheets"); // Quay lại trang quản trị
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchSheetDetail();
  }, [id]);

  const handleSaveSheet = async (title: string, content: any) => {
    if (!id) return;
    try {
      const res = await apiClient.put(`/api/v1/spreadsheets/${id}`, {
        title,
        content
      });
      setSheetData(res.data.data);
      toast.success("Đã lưu trang tính thành công!");
    } catch (err: any) {
      toast.error("Lỗi khi lưu trang tính: " + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return (
      <div className="w-screen h-screen bg-[var(--bg-1)]" />
    );
  }

  if (!sheetData) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[var(--bg)] gap-4">
        <p className="text-red-500 font-semibold">Không tìm thấy trang tính!</p>
        <button 
          onClick={() => navigate("/admin/sheets")} 
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  // Ở trang biên tập tách biệt, FortuneSheetEditor sẽ chiếm 100vh để người dùng thao tác tối đa diện tích
  return (
    <div className="w-screen h-screen overflow-hidden bg-[var(--bg-1)]">
      <FortuneSheetEditor
        sheetId={id!}
        initialTitle={sheetData.title}
        initialContent={sheetData.content}
        onBack={() => navigate("/admin/sheets")}
        onSave={handleSaveSheet}
      />
    </div>
  );
};

export default SheetEditorPage;
