import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../context/AuthContext.js";
import { toast } from "react-toastify";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
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
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-sm border border-gray-100 my-8">
      <h2 className="text-xl font-bold mb-6 text-center text-gray-800">
        {isSignUp ? "Đăng ký tài khoản" : "Đăng nhập hệ thống"}
      </h2>
      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
            placeholder="example@hou.edu.vn"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
            placeholder="******"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded text-sm transition"
        >
          {loading ? "Đang xử lý..." : isSignUp ? "Đăng ký" : "Đăng nhập"}
        </button>
      </form>
      <div className="mt-4 text-center text-xs text-gray-500">
        <button onClick={() => setIsSignUp(!isSignUp)} className="text-indigo-600 hover:underline">
          {isSignUp ? "Đã có tài khoản? Đăng nhập ngay" : "Chưa có tài khoản? Đăng ký mới"}
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
