import React, { useState, useEffect } from "react";
import {
  Cpu,
  Server,
  Activity,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Send,
  Lock,
  Globe,
} from "lucide-react";
import "../../css/nine-router.css";

interface StatusResult {
  ok: boolean;
  targetUrl: string;
  statusCode?: number;
  message?: string;
  error?: string;
}

export const NineRouterTab: React.FC = () => {
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [testPrompt, setTestPrompt] = useState<string>("Xin chào AI 9Router!");
  const [testResponse, setTestResponse] = useState<string>("");
  const [testing, setTesting] = useState<boolean>(false);

  const proxyEndpoint = `${window.location.origin}/api/v1/nine-router/v1`;

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/nine-router/status", {
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      setStatus({
        ok: false,
        targetUrl: "http://localhost:20128",
        error: err.message,
        message: "Lỗi kết nối tới Backend Proxy.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const openNineRouterWeb = () => {
    const target = status?.targetUrl || "http://localhost:20128";
    window.open(`${target}/dashboard`, "_blank");
  };

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPrompt.trim()) return;

    setTesting(true);
    setTestResponse("Đang gửi yêu cầu thử nghiệm tới 9Router...");

    try {
      const res = await fetch("/api/v1/nine-router/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          model: "auto",
          messages: [{ role: "user", content: testPrompt }],
        }),
      });

      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        const rawText = await res.text();
        let message = rawText;
        try {
          const parsed = JSON.parse(rawText);
          message = parsed.message || parsed.error || JSON.stringify(parsed);
        } catch {
          // Keep rawText
        }
        setTestResponse(`Lỗi ${res.status}: ${message}`);
      } else if (contentType.includes("application/json")) {
        const data = await res.json();
        const output = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
        setTestResponse(output);
      } else {
        const text = await res.text();
        setTestResponse(text.slice(0, 1000));
      }
    } catch (err: any) {
      setTestResponse(`Lỗi kết nối: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="nine-router-container">
      {/* Standard Admin Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-soft)]">
        <div>
          <h1 className="text-xl font-bold text-[var(--fg)] flex items-center gap-2">
            <Cpu className="w-6 h-6 text-[var(--brand-600)]" />
            9Router AI Gateway & Dashboard
          </h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            Điều hướng AI thông minh & Quản lý multi-account AI Providers cho HOU
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={checkStatus}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--fg)] hover:bg-[var(--bg-2)] transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>

          <div
            className={`nine-router-status-badge ${
              loading
                ? "checking"
                : status?.ok
                ? "online"
                : "offline"
            }`}
          >
            {loading ? (
              <>
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                Đang kiểm tra...
              </>
            ) : status?.ok ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Dịch vụ Hoạt động (Live)
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" />
                Ngoại tuyến (Offline)
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Direct Web Launcher Hero Banner */}
      <div className="nine-router-card bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white p-6 border-none shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-semibold text-blue-300">
              <Globe className="w-3.5 h-3.5" /> Direct Web Access (Port 20128)
            </div>
            <h2 className="text-xl font-bold text-white">
              Truy cập Giao diện Web 9Router Trực tiếp
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl">
              Mở trực tiếp trang Web Dashboard độc lập của 9Router để quản lý AI providers, combo models, OAuth tokens và xem thống kê sử dụng realtime.
            </p>
          </div>

          <button
            onClick={openNineRouterWeb}
            className="nine-router-btn-primary bg-blue-600 hover:bg-blue-500 text-white text-base font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-blue-500/25 shrink-0"
          >
            <ExternalLink className="w-5 h-5" />
            Mở Web 9Router Ngay
          </button>
        </div>
      </div>

      {/* Quick Overview Cards */}
      <div className="nine-router-grid">
        {/* Card 1: Role Access Info */}
        <div className="nine-router-card">
          <div className="nine-router-card-title">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Phân quyền Bảo mật
          </div>
          <p className="text-sm text-slate-600 mb-3">
            Quyền truy cập 9Router Gateway được giới hạn nghiêm ngặt bởi Hono Middleware Backend:
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="nine-router-badge-role">Admin (Level 100)</span>
            <span className="nine-router-badge-role">Management (Level 90)</span>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1 mt-2">
            <Lock className="w-3.5 h-3.5" />
            Các role khác (Ultra, Pro, Plus, Free) bị từ chối truy cập 403.
          </div>
        </div>

        {/* Card 2: Endpoint info */}
        <div className="nine-router-card">
          <div className="nine-router-card-title">
            <Server className="w-5 h-5 text-emerald-600" />
            Proxy Gateway Endpoint
          </div>
          <p className="text-sm text-slate-600 mb-2">
            OpenAI-Compatible Base Endpoint (qua Hono Auth Proxy):
          </p>
          <div className="nine-router-code-block mb-2">
            {proxyEndpoint}
          </div>
          <div className="text-xs text-slate-500">
            Target Service URL: {status?.targetUrl || "http://localhost:20128"}
          </div>
        </div>

        {/* Card 3: Test Request */}
        <div className="nine-router-card">
          <div className="nine-router-card-title">
            <Send className="w-5 h-5 text-indigo-600" />
            Test AI Completion Gateway
          </div>
          <form onSubmit={handleTestSubmit} className="nine-router-test-area">
            <input
              type="text"
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Nhập prompt thử nghiệm..."
              className="nine-router-input"
            />
            <button
              type="submit"
              disabled={testing || !status?.ok}
              className="nine-router-btn-primary"
            >
              <Send className="w-4 h-4" />
              {testing ? "Đang gửi..." : "Gửi thử nghiệm"}
            </button>
          </form>
          {testResponse && (
            <div className="nine-router-test-response">
              {testResponse}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NineRouterTab;
