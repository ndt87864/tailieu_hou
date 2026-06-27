import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient, type User, type Session } from "@supabase/supabase-js";
import apiClient, { setAuthToken } from "../services/client.js";

interface AuthContextType {
  user: User | null;
  role: string;
  profile: any | null;
  loading: boolean;
  session: Session | null;
  logout: () => Promise<void>;
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

  const fetchProfile = async (token: string) => {
    try {
      setAuthToken(token);
      const res = await apiClient.get("/api/v1/auth/profile");
      setRole(res.data.role || "free");
      setProfile(res.data.profile || null);
    } catch (err) {
      console.error("Lỗi đồng bộ profile với backend:", err);
      setRole("free");
      setProfile(null);
    }
  };

  useEffect(() => {
    // 1. Lấy session hiện tại
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        fetchProfile(session.access_token).then(() => setLoading(false));
      } else {
        setAuthToken(null);
        setRole("guest");
        setProfile(null);
        setLoading(false);
      }
    });

    // 2. Lắng nghe thay đổi auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        fetchProfile(session.access_token);
      } else {
        setAuthToken(null);
        setRole("guest");
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole("guest");
    setProfile(null);
    setAuthToken(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, session, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
