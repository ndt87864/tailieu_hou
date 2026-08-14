import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "../../context/AuthContext.js";
import { toast } from "react-toastify";
import { Mail, Lock, Eye, EyeOff, ArrowRight, LogIn, UserPlus, CheckCircle, User, Phone, GraduationCap, Compass, BookOpenCheck } from "lucide-react";
import "../../css/login.css";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const location = useLocation();
  const isSignUp = location.pathname === "/register";
  const [isForgotPassword, setIsForgotPassword] = useState<boolean>(false);
  const [forgotSent, setForgotSent] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setFullName("");
    setPhone("");
    setConfirmPassword("");
  }, [location.pathname]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSignUp) {
      if (!fullName.trim()) { toast.warn("Vui lòng nhập họ và tên."); return; }
      if (!email) { toast.warn("Vui lòng nhập email."); return; }
      if (!password) { toast.warn("Vui lòng nhập mật khẩu."); return; }
      if (password.length < 6) { toast.warn("Mật khẩu phải có ít nhất 6 ký tự."); return; }
      if (!confirmPassword) { toast.warn("Vui lòng nhập lại mật khẩu."); return; }
      if (password !== confirmPassword) { toast.error("Mật khẩu nhập lại không khớp."); return; }

      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || null,
          },
        },
      });
      if (error) toast.error(error.message);
      else { toast.success("Đăng ký thành công! Hãy kiểm tra email hoặc đăng nhập ngay."); navigate("/login"); }
    } else {
      if (!email || !password) { toast.warn("Vui lòng điền đầy đủ thông tin."); return; }

      setLoading(true);
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
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const renderLeftSidebar = () => (
    <div className="login-hero-sidebar">
      <div className="login-hero-mesh" />
      <div className="login-hero-content">
        <div className="login-hero-badge">
          <GraduationCap className="w-4 h-4 text-emerald-300" />
          Tài liệu HOU
        </div>
        <h2 className="login-hero-title">
          Chìa khóa chinh phục mọi kỳ thi
        </h2>
        <p className="login-hero-subtitle">
          Khám phá kho đề thi phong phú, các tóm tắt lý thuyết chất lượng cao và hệ thống câu hỏi trắc nghiệm ôn tập chuẩn xác.
        </p>

        <div className="login-feature-list">
          <div className="login-feature-item">
            <div className="login-feature-icon-wrapper">
              <GraduationCap className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h4 className="login-feature-item-title">Ngân hàng đề thi đa dạng</h4>
              <p className="login-feature-item-desc">Được sưu tầm và giải chi tiết qua các kỳ thi chính thức của trường.</p>
            </div>
          </div>

          <div className="login-feature-item">
            <div className="login-feature-icon-wrapper">
              <Compass className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h4 className="login-feature-item-title">Tóm tắt lý thuyết trực quan</h4>
              <p className="login-feature-item-desc">Tập trung kiến thức cốt lõi giúp nắm vững lý thuyết nhanh chóng nhất.</p>
            </div>
          </div>

          <div className="login-feature-item">
            <div className="login-feature-icon-wrapper">
              <BookOpenCheck className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h4 className="login-feature-item-title">Bài tập trắc nghiệm phong phú</h4>
              <p className="login-feature-item-desc">Kiểm tra kiến thức trực tiếp và theo dõi sự tiến bộ của bản thân.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="py-8 max-w-6xl mx-auto px-4">
      <div className="login-grid">
        {/* Left Column (Hero Card) */}
        {renderLeftSidebar()}

        {/* Right Column (Form Panel) */}
        <div className="login-form-sidebar">
          {/* Header */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 login-brand-logo-container p-1">
              <img src="/logo.png" alt="Logo Tài liệu HOU" className="w-full h-full object-contain" />
            </Link>
            <h1 className="login-title">
              {isForgotPassword ? "Khôi phục mật khẩu" : isSignUp ? "Đăng ký thành viên" : "Đăng nhập tài khoản"}
            </h1>
            <p className="login-subtitle">
              {isForgotPassword 
                ? "Nhập email của bạn để nhận liên kết thiết lập lại mật khẩu" 
                : isSignUp 
                  ? "Bắt đầu hành trình chinh phục tri thức cùng HOU" 
                  : "Truy cập kho tài liệu học thuật và ôn luyện trực tuyến"}
            </p>
          </div>

          {/* Forgot Password Flow */}
          {isForgotPassword ? (
            <div>
              {forgotSent ? (
                <div className="text-center py-4 space-y-4">
                  <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
                  <p className="font-semibold text-base">Đã gửi liên kết thành công!</p>
                  <p className="login-subtitle text-center">
                    Kiểm tra hộp thư điện tử <strong>{email}</strong> và làm theo hướng dẫn để cài đặt lại mật khẩu.
                  </p>
                  <button
                    onClick={() => { setIsForgotPassword(false); setForgotSent(false); }}
                    className="btn-brand w-full py-3 text-sm mt-4 font-bold"
                  >
                    Quay lại đăng nhập
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="login-label-style">Email khôi phục</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 login-icon-meta" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input pl-11"
                        placeholder="example@hou.edu.vn"
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-brand w-full py-3 text-sm font-bold"
                  >
                    {loading ? "Đang xử lý..." : "Gửi liên kết khôi phục"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="w-full text-xs text-center py-2 transition-colors login-btn-back font-bold"
                  >
                    ← Quay lại đăng nhập
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Login / Signup Forms */
            <form onSubmit={handleAuth} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="login-label-style">Họ và tên <span className="login-label-required">*</span></label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 login-icon-meta" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input pl-11"
                      placeholder="Nguyễn Văn A"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="login-label-style">Địa chỉ Email {isSignUp && <span className="login-label-required">*</span>}</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 login-icon-meta" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-11"
                    placeholder="example@hou.edu.vn"
                    required
                  />
                </div>
              </div>

              {isSignUp && (
                <div>
                  <label className="login-label-style">Số điện thoại <span className="login-label-optional">(tùy chọn)</span></label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 login-icon-meta" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input pl-11"
                      placeholder="0912 345 678"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="login-label-style !mb-0">Mật khẩu {isSignUp && <span className="login-label-required">*</span>}</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs transition-colors hover:underline login-btn-forgot"
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 login-icon-meta" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-11 pr-12"
                    placeholder={isSignUp ? "Tối thiểu 6 ký tự" : "••••••••"}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 hover:text-[var(--fg)] transition-colors login-icon-eye"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div>
                  <label className="login-label-style">Nhập lại mật khẩu <span className="login-label-required">*</span></label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 login-icon-meta" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`input pl-11 pr-12 ${
                        confirmPassword
                          ? confirmPassword === password
                            ? "login-border-match"
                            : "login-border-mismatch"
                          : ""
                      }`}
                      placeholder="Nhập lại mật khẩu"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 hover:text-[var(--fg)] transition-colors login-icon-eye"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && (
                    <p className={confirmPassword === password ? "login-feedback-match" : "login-feedback-mismatch"}>
                      {confirmPassword === password ? "✓ Mật khẩu khớp" : "✗ Mật khẩu không khớp"}
                    </p>
                  )}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-brand w-full py-3 text-sm font-bold flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Đang xử lý...
                  </>
                ) : isSignUp ? (
                  <><UserPlus className="w-4 h-4" /> Đăng ký tài khoản</>
                ) : (
                  <><LogIn className="w-4 h-4" /> Đăng nhập</>
                )}
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--border-soft)]" />
                </div>
                <span className="relative px-3 text-[10px] bg-[var(--surface)] text-[var(--meta)] uppercase font-bold tracking-wider">
                  Hoặc
                </span>
              </div>

              {/* Google Login */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="btn-outline w-full py-3 text-sm flex items-center justify-center gap-2 font-bold"
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
          )}

          {/* Toggle sign up / login */}
          <div className="login-toggle-container">
            <Link
              to={isSignUp ? "/login" : "/register"}
              className="inline-flex items-center gap-1.5 hover:text-[var(--brand-600)] transition-colors group login-toggle-text"
            >
              {isSignUp ? (
                <>
                  Đã có tài khoản?
                  <span className="group-hover:underline login-toggle-link">Đăng nhập ngay</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </>
              ) : (
                <>
                  Chưa có tài khoản?
                  <span className="group-hover:underline login-toggle-link">Đăng ký mới</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Link>
          </div>

          {/* Back Home */}
          <div className="text-center mt-4">
            <Link to="/" className="hover:text-[var(--fg)] transition-colors login-back-home font-semibold">
              ← Quay lại trang chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;