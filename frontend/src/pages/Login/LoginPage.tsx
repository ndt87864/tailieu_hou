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
    if (!email || !password) {
      toast.warn("Vui lòng điền đầy đủ thông tin.");
      return;
    }

    setLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Đăng ký thành công! Hãy kiểm tra email hoặc đăng nhập ngay.");
        setIsSignUp(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Đăng nhập thành công!");
        navigate("/");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-brand shadow-lg shadow-brand-200/50 mb-5">
            <BookOpen className="w-7 h-7 text-white" />
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            {isSignUp ? "Tạo tài khoản mới" : "Chào mừng trở lại"}
          </h1>
          <p className="text-sm text-gray-500 mt-1.5">
            {isSignUp
              ? "Đăng ký để truy cập kho tài liệu ôn thi HOU"
              : "Đăng nhập để tiếp tục hành trình ôn thi của bạn"}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-card-lg p-6 sm:p-8">
          <form onSubmit={handleAuth} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-50 outline-none transition-all duration-250 bg-gray-50/50 focus:bg-white"
                  placeholder="example@hou.edu.vn"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-50 outline-none transition-all duration-250 bg-gray-50/50 focus:bg-white"
                  placeholder={isSignUp ? "Tối thiểu 6 ký tự" : "••••••••"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold py-3 rounded-xl transition-all duration-250 shadow-sm hover:shadow-md active:scale-[0.98] text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Đang xử lý...
                </>
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Đăng ký
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Đăng nhập
                </>
              )}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-6 pt-5 border-t border-gray-50 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition-colors group"
            >
              {isSignUp ? (
                <>
                  Đã có tài khoản?
                  <span className="font-semibold text-brand-600 group-hover:underline">Đăng nhập ngay</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </>
              ) : (
                <>
                  Chưa có tài khoản?
                  <span className="font-semibold text-brand-600 group-hover:underline">Đăng ký mới</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Back link */}
        <p className="text-center mt-6">
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Quay lại trang chủ
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;