import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient, type User, type Session } from "@supabase/supabase-js";
import apiClient, { setAuthToken } from "../services/client.js";
import { clearAllCache } from "../utils/apiCache.js";

interface AuthContextType {
  user: User | null;
  role: string;
  profile: any | null;
  loading: boolean;
  session: Session | null;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string>("guest");
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (token: string, userId: string, force: boolean = false) => {
    try {
      setAuthToken(token);

      const cachedProfile = localStorage.getItem("user-profile");
      const cachedRole = localStorage.getItem("user-role");
      const profileSynced = localStorage.getItem("profile-synced");

      if (!force && profileSynced === userId && cachedProfile && cachedRole) {
        setRole(cachedRole);
        setProfile(JSON.parse(cachedProfile));
        return;
      }

      const res = await apiClient.get("/api/v1/auth/profile");
      const fetchedRole = res.data.role || "free";
      const fetchedProfile = res.data.profile || null;
      if (fetchedProfile && res.data.user?.user_metadata) {
        fetchedProfile.avatar_url = fetchedProfile.avatar_url || res.data.user.user_metadata.avatar_url || res.data.user.user_metadata.picture || null;
        fetchedProfile.full_name = fetchedProfile.full_name || res.data.user.user_metadata.full_name || res.data.user.user_metadata.name || fetchedProfile.full_name;
      }

      setRole(fetchedRole);
      setProfile(fetchedProfile);

      localStorage.setItem("user-role", fetchedRole);
      localStorage.setItem("user-profile", JSON.stringify(fetchedProfile));
      localStorage.setItem("profile-synced", userId);
    } catch (err) {
      console.error("Lỗi đồng bộ profile với backend:", err);
      setRole("free");
      setProfile(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      clearAllCache();
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.access_token) {
        // Lưu token vào Cookie SameSite=Lax để các request Iframe nội bộ tự động gửi kèm cookie
        document.cookie = `sb-access-token=${encodeURIComponent(session.access_token)}; path=/; SameSite=Lax; max-age=28800`;
      } else {
        document.cookie = `sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }

      if (session) {
        fetchProfile(session.access_token, session.user.id).then(() => {
          setLoading(false);
        });
      } else {
        setAuthToken(null);
        setRole("guest");
        setProfile(null);
        // Clear local storage cache
        localStorage.removeItem("user-role");
        localStorage.removeItem("user-profile");
        localStorage.removeItem("profile-synced");
        localStorage.removeItem("ui-theme-mode");
        localStorage.removeItem("ui-primary-color");
        localStorage.removeItem("ui-settings-synced");
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    setLoading(true);
    document.cookie = `sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole("guest");
    setProfile(null);
    setAuthToken(null);

    // Clear local storage cache
    localStorage.removeItem("user-role");
    localStorage.removeItem("user-profile");
    localStorage.removeItem("profile-synced");
    localStorage.removeItem("ui-theme-mode");
    localStorage.removeItem("ui-primary-color");
    localStorage.removeItem("ui-settings-synced");

    setLoading(false);
  };

  const refreshProfile = async () => {
    if (session) {
      await fetchProfile(session.access_token, session.user.id, true);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, session, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
