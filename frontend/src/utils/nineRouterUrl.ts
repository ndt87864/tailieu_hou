import apiClient from "../services/client.js";

export const getNineRouterBaseUrl = (): string => {
  if (import.meta.env.VITE_NINE_ROUTER_URL) {
    return import.meta.env.VITE_NINE_ROUTER_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:20128";
    }
    // Khi chạy trên domain hosting thực tế
    return "https://9router-hou.duckdns.org";
  }
  return "https://9router-hou.duckdns.org";
};

export const isNineRouterOrigin = (origin: string): boolean => {
  const baseUrl = getNineRouterBaseUrl();
  try {
    const nineOrigin = new URL(baseUrl).origin;
    if (origin === nineOrigin) return true;
  } catch (e) {
    // Ignore invalid URL parse error
  }
  return origin === "http://localhost:20128" || origin === "https://localhost:20128";
};

export const getNineRouterSsoUrl = async (redirectPath: string = "/dashboard"): Promise<string> => {
  const baseUrl = getNineRouterBaseUrl();
  const targetRedirect = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;

  try {
    const res = await apiClient.get<{ ok: boolean; token: string; redirectPath: string }>(
      `/api/v1/nine-router/sso-url?redirect=${encodeURIComponent(targetRedirect)}`
    );
    if (res.data?.ok && res.data?.token) {
      return `${baseUrl}/api/auth/sso?token=${res.data.token}&redirect=${encodeURIComponent(targetRedirect)}`;
    }
  } catch (err) {
    console.warn("Lỗi tạo 9Router SSO token:", err);
  }

  return `${baseUrl}${targetRedirect}`;
};

export const openNineRouterWithSso = async (redirectPath: string = "/dashboard", target: string = "_blank") => {
  const ssoUrl = await getNineRouterSsoUrl(redirectPath);
  window.open(ssoUrl, target);
};
