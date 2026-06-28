/**
 * Frontend in-memory API cache (stale-while-revalidate pattern)
 * 
 * - Lần đầu: fetch từ server, lưu vào cache
 * - Lần sau (trong TTL): trả ngay từ cache, fetch ngầm để refresh
 * - Sau TTL: coi như stale, vẫn trả về data cũ trong khi fetch mới
 */

import apiClient from "../services/client.js";
import type { AxiosRequestConfig } from "axios";

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  revalidating: boolean;
}

const store = new Map<string, CacheEntry<any>>();

/**
 * Fresh TTL: trong khoảng này luôn trả từ cache, không fetch.
 * Sau đó fetch ngầm ở background (stale-while-revalidate).
 */
const FRESH_TTL = 5 * 60 * 1000; // 5 phút

/**
 * Stale TTL: sau khoảng này thì force-refetch (block).
 */
const STALE_TTL = 15 * 60 * 1000; // 15 phút

function isFresh(entry: CacheEntry<any>): boolean {
  return Date.now() - entry.cachedAt < FRESH_TTL;
}

function isStale(entry: CacheEntry<any>): boolean {
  return Date.now() - entry.cachedAt > STALE_TTL;
}

async function fetchAndStore<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.get<T>(url, config);
  store.set(url, {
    data: res.data,
    cachedAt: Date.now(),
    revalidating: false,
  });
  return res.data;
}

/**
 * Fetch với cache — drop-in replacement cho apiClient.get()
 * 
 * Trả về { data } giống axios response để dễ dùng.
 */
export async function cachedGet<T>(url: string, config?: AxiosRequestConfig): Promise<{ data: T }> {
  const entry = store.get(url);

  if (entry) {
    if (isFresh(entry)) {
      // Còn fresh: trả ngay từ cache
      return { data: entry.data };
    }

    if (!isStale(entry) && !entry.revalidating) {
      // Stale-while-revalidate: trả cache cũ, fetch ngầm ở background
      entry.revalidating = true;
      fetchAndStore(url, config).catch(console.error);
      return { data: entry.data };
    }

    if (isStale(entry)) {
      // Quá stale: trả data cũ ngay nhưng chờ fetch xong để cập nhật
      const fresh = await fetchAndStore<T>(url, config);
      return { data: fresh };
    }

    // Đang revalidate: trả cache hiện tại
    return { data: entry.data };
  }

  // Cache miss: fetch lần đầu
  const data = await fetchAndStore<T>(url, config);
  return { data };
}

/**
 * Xóa cache cho một URL cụ thể.
 */
export function invalidateCache(url: string): void {
  store.delete(url);
}

/**
 * Xóa tất cả cache.
 */
export function clearAllCache(): void {
  store.clear();
}
