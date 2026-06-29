/**
 * useAdminCategories — hook dùng chung cho tất cả admin tabs.
 *
 * Lưu kết quả vào module-level cache: chỉ gọi API 1 lần duy nhất trong
 * suốt phiên làm việc, kể cả khi nhiều component cùng mount gọi hook này.
 * Sau khi thêm / sửa / xóa danh mục, gọi invalidateAdminCategoriesCache()
 * để buộc fetch lại lần kế tiếp.
 */

import { useEffect, useState, useCallback } from "react";
import apiClient from "../services/client.js";

export interface AdminCategory {
  id: string;
  title: string;
  slug: string;
  logo: string | null;
  stt: number;
  active: boolean;
  premium: boolean;
}

// ---------- Module-level cache (shared across all hook instances) ----------
let cachedCategories: AdminCategory[] | null = null;
let isFetching = false;
const subscribers: Array<() => void> = [];

function notifySubscribers() {
  subscribers.forEach((fn) => fn());
}

/** Xóa cache — gọi sau khi thêm / sửa / xóa danh mục */
export function invalidateAdminCategoriesCache() {
  cachedCategories = null;
}
// --------------------------------------------------------------------------

export function useAdminCategories() {
  const [categories, setCategories] = useState<AdminCategory[]>(
    cachedCategories ?? []
  );
  const [loading, setLoading] = useState(!cachedCategories);

  const refresh = useCallback(async () => {
    setLoading(true);
    invalidateAdminCategoriesCache();
    isFetching = false;
    // trigger lại bằng cách dispatch empty-reload
    const res = await apiClient.get("/api/v1/admin/categories");
    cachedCategories = res.data.categories || [];
    setCategories(cachedCategories!);
    setLoading(false);
    notifySubscribers();
  }, []);

  useEffect(() => {
    // Nếu đã có cache → dùng ngay, không fetch
    if (cachedCategories !== null) {
      setCategories(cachedCategories);
      setLoading(false);
      return;
    }

    // Nếu chưa có cache nhưng đang fetch → đăng ký subscriber chờ kết quả
    const onUpdate = () => {
      if (cachedCategories !== null) {
        setCategories(cachedCategories);
        setLoading(false);
      }
    };

    if (isFetching) {
      subscribers.push(onUpdate);
      return () => {
        const idx = subscribers.indexOf(onUpdate);
        if (idx !== -1) subscribers.splice(idx, 1);
      };
    }

    // Chưa có cache và chưa ai đang fetch → fetch mới
    isFetching = true;
    apiClient
      .get("/api/v1/admin/categories")
      .then((res) => {
        cachedCategories = res.data.categories || [];
        isFetching = false;
        onUpdate();
        notifySubscribers();
      })
      .catch((err) => {
        console.error("useAdminCategories: fetch failed", err);
        isFetching = false;
        cachedCategories = [];
        onUpdate();
        notifySubscribers();
      });

    return () => {
      const idx = subscribers.indexOf(onUpdate);
      if (idx !== -1) subscribers.splice(idx, 1);
    };
  }, []);

  return { categories, loading, refresh };
}
