import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../context/AuthContext.js";
import { toast } from "react-toastify";
import { BookOpen, Mail, Lock, Eye, EyeOff, ArrowRight, LogIn, UserPlus, KeyRound, CheckCircle } from "lucide-react";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [isForgotPassword, setIsForgotPassword] = useState<boolean>(false);
  const [forgotSent, setForgotSent] = useState<boolean>(false);
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.warn("Vui lòng nhập địa chỉ email."); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setForgotSent(true);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  // --- Forgot Password Screen ---
  if (isForgotPassword) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md animate-fade-up">
          {/* Brand */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
              style={{ background: "linear-gradient(135deg, var(--brand-700), var(--brand-500))", boxShadow: "0 8px 24px color-mix(in srgb, var(--brand-600) 30%, transparent)" }}
            >
              <KeyRound className="w-7 h-7 text-white" />
            </div>
            <h1 style={{ color: "var(--fg)", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Đặt lại mật khẩu
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.375rem" }}>
              Nhập email để nhận liên kết đặt lại mật khẩu
            </p>
          </div>

          <div className="card p-6 sm:p-8">
            {forgotSent ? (
              <div className="text-center py-4 space-y-4">
                <CheckCircle className="w-12 h-12 mx-auto" style={{ color: "var(--brand-600)" }} />
                <p style={{ color: "var(--fg)", fontWeight: 600 }}>Email đã được gửi!</p>
                <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
                  Kiểm tra hộp thư <strong>{email}</strong> và làm theo hướng dẫn để đặt lại mật khẩu.
                </p>
                <button
                  onClick={() => { setIsForgotPassword(false); setForgotSent(false); }}
                  className="btn-brand w-full py-3 text-sm mt-2"
                >
                  Quay lại đăng nhập
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
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
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-brand w-full py-3 text-sm"
                  style={{ opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    <>Gửi link đặt lại mật khẩu</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="w-full text-sm text-center py-2 transition-colors"
                  style={{ color: "var(--muted)" }}
                >
                  ← Quay lại đăng nhập
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Main Login / Sign Up Screen ---
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
              <div className="flex items-center justify-between mb-2">
                <label style={{ color: "var(--muted)", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Mật khẩu
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs transition-colors hover:underline"
                    style={{ color: "var(--brand-600)" }}
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
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

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border-soft)]" />
              </div>
              <span className="relative px-3 text-xs bg-[var(--surface)] text-[var(--meta)] uppercase font-semibold">
                Hoặc
              </span>
            </div>

            {/* Google Login */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="btn-outline w-full py-3 text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.2662 9.7645C6.1988 6.9386 8.8547 4.9091 12 4.9091C13.6909 4.9091 15.2182 5.5282 16.4 6.5455L19.7364 3.2091C17.6545 1.2227 14.9727 0 12 0C7.33 0 3.3283 2.7815 1.5035 6.7937L5.2662 9.7645Z" />
                <path fill="#34A853" d="M16.0407 18.0126C14.9509 18.7163 13.5661 19.0909 12 19.0909C8.8547 19.0909 6.1988 17.0614 5.2662 14.2355L1.5035 17.2063C3.3283 21.2185 7.33 24 12 24C14.9316 24 17.736 22.9229 19.8315 21.0621L16.0407 18.0126Z" />
                <path fill="#4285F4" d="M23.49 12.2727C23.49 11.4436 23.41 10.68 23.2791 9.9491L12 9.9491V14.5418H18.4527C18.1727 16.05 17.3091 17.22 16.0407 18.0126L19.8315 21.0621C22.0295 19.0432 23.49 16.0091 23.49 12.2727Z" />
                <path fill="#FBBC05" d="M5.2662 9.7645C5.0124 10.5376 4.8727 11.3592 4.8727 12C4.8727 12.6408 5.0124 13.4624 5.2662 14.2355L1.5035 17.2063C0.54898 15.103 0 12.7259 0 12C0 11.2741 0.54898 8.897 1.5035 6.7937L5.2662 9.7645Z" />
              </svg>
              Tiếp tục với Google
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