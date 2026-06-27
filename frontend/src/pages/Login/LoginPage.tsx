import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../context/AuthContext.js";
import { toast } from "react-toastify";
import { BookOpen, Mail, Lock, Eye, EyeOff, ArrowRight, LogIn, UserPlus } from "lucide-react";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.warn("Vui lòng điền đầy đủ thông tin."); return; }
    setLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) toast.error(error.message);
      else { toast.success("Đăng ký thành công! Hãy kiểm tra email hoặc đăng nhập ngay."); setIsSignUp(false); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else { toast.success("Đăng nhập thành công!"); navigate("/"); }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-up">

        {/* Brand */}
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{ background: "linear-gradient(135deg, var(--brand-700), var(--brand-500))", boxShadow: "0 8px 24px color-mix(in srgb, var(--brand-600) 30%, transparent)" }}
          >
            <BookOpen className="w-7 h-7 text-white" />
          </Link>
          <h1 style={{ color: "var(--fg)", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {isSignUp ? "Tạo tài khoản mới" : "Chào mừng trở lại"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.375rem" }}>
            {isSignUp
              ? "Đăng ký để truy cập kho tài liệu ôn thi HOU"
              : "Đăng nhập để tiếp tục hành trình ôn thi của bạn"}
          </p>
        </div>

        {/* Form Card */}
        <div className="card p-6 sm:p-8">
          <form onSubmit={handleAuth} className="space-y-5">
            {/* Email */}
            <div>
              <label style={{ color: "var(--muted)", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.5rem" }}>
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--meta)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-11"
                  placeholder="example@hou.edu.vn"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ color: "var(--muted)", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.5rem" }}>
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--meta)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-11 pr-12"
                  placeholder={isSignUp ? "Tối thiểu 6 ký tự" : "••••••••"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  style={{ color: "var(--meta)" }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 hover:text-[var(--fg)] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-brand w-full py-3 text-sm"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Đang xử lý...
                </>
              ) : isSignUp ? (
                <><UserPlus className="w-4 h-4" />Đăng ký</>
              ) : (
                <><LogIn className="w-4 h-4" />Đăng nhập</>
              )}
            </button>
          </form>

          {/* Toggle sign up / login */}
          <div style={{ borderTop: "1px solid var(--border-soft)", marginTop: "1.5rem", paddingTop: "1.25rem", textAlign: "center" }}>
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              style={{ color: "var(--muted)", fontSize: "0.875rem" }}
              className="inline-flex items-center gap-1.5 hover:text-[var(--brand-600)] transition-colors group"
            >
              {isSignUp ? (
                <>
                  Đã có tài khoản?
                  <span style={{ color: "var(--brand-600)", fontWeight: 600 }} className="group-hover:underline">Đăng nhập ngay</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </>
              ) : (
                <>
                  Chưa có tài khoản?
                  <span style={{ color: "var(--brand-600)", fontWeight: 600 }} className="group-hover:underline">Đăng ký mới</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Back */}
        <p className="text-center mt-6">
          <Link to="/" style={{ color: "var(--meta)", fontSize: "0.75rem" }} className="hover:text-[var(--fg)] transition-colors">
            ← Quay lại trang chủ
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;