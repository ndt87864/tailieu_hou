"use client";

import { create } from "zustand";

const useUserStore = create((set, get) => ({
  user: null,
  loading: false,
  error: null,
  lastFetched: 0,
  activePromise: null,

  setUser: (user) => set({ user }),

  clearUser: () => set({ user: null }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  fetchUser: async ({ force = false } = {}) => {
    const { user, lastFetched, activePromise, loading } = get();
    if (!force && user && Date.now() - lastFetched < 60000) return user;
    if (activePromise) return activePromise;
    if (loading && !force) return activePromise;

    set({ loading: true, error: null });
    const promise = (async () => {
      try {
        const res = await fetch("/api/auth/status");
        if (res.ok) {
          const data = await res.json();
          set({ user: data, loading: false, lastFetched: Date.now(), activePromise: null });
          return data;
        }
        set({ loading: false, activePromise: null });
        return null;
      } catch {
        set({ error: "Failed to fetch user", loading: false, activePromise: null });
        return null;
      }
    })();

    set({ activePromise: promise });
    return promise;
  },
}));

export default useUserStore;

