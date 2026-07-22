import { NextResponse } from "next/server";
import { getProviderCredentials } from "@/sse/services/auth.js";
import { getProviderConnections } from "@/lib/localDb";
import { resolveConnectionProxyConfig } from "@/lib/network/connectionProxy";
import { LunaExecutor } from "open-sse/executors/luna.js";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const systemPrompt = body.systemPrompt || body.instruction || "";

    if (!systemPrompt || typeof systemPrompt !== "string" || !systemPrompt.trim()) {
      return NextResponse.json(
        { success: false, error: "Thiếu nội dung systemPrompt / instruction." },
        { status: 400 }
      );
    }

    let credentials = await getProviderCredentials("luna", null, "qwen3.8-max-preview");

    if (!credentials || credentials.allRateLimited || (!credentials.apiKey && !credentials.accessToken)) {
      const connections = await getProviderConnections({ provider: "luna" });
      const activeConn = connections.find((c) => c.isActive !== false) || connections[0];

      if (!activeConn) {
        return NextResponse.json(
          { success: false, error: "Không tìm thấy tài khoản Luna (Qwen) nào trong hệ thống." },
          { status: 400 }
        );
      }

      const proxyConfig = await resolveConnectionProxyConfig(activeConn.providerSpecificData || {});
      credentials = {
        authType: activeConn.authType,
        apiKey: activeConn.apiKey,
        accessToken: activeConn.accessToken,
        token: activeConn.apiKey || activeConn.accessToken,
        providerSpecificData: {
          ...(activeConn.providerSpecificData || {}),
          ...proxyConfig,
        },
      };
    }

    if (!credentials.token) {
      credentials.token = credentials.apiKey || credentials.accessToken || "";
    }

    const proxyOptions = {
      connectionProxyEnabled: credentials.providerSpecificData?.connectionProxyEnabled,
      connectionProxyUrl: credentials.providerSpecificData?.connectionProxyUrl,
      connectionNoProxy: credentials.providerSpecificData?.connectionNoProxy,
      vercelRelayUrl: credentials.providerSpecificData?.vercelRelayUrl,
    };

    const lunaExecutor = new LunaExecutor();
    const updateResult = await lunaExecutor.updateSystemPrompt(systemPrompt, credentials, proxyOptions);

    if (updateResult?.success) {
      return NextResponse.json({
        success: true,
        verified: updateResult.verified ?? false,
        message: updateResult.verified
          ? "Đã cập nhật và xác thực thành công System Prompt sang Qwen Web (xác nhận qua GET /api/v2/users/user/settings)!"
          : "Đã gửi request cập nhật sang Qwen Web thành công!",
        currentInstruction: updateResult.currentInstruction || "",
        settings: updateResult.settings || null,
        data: updateResult.data,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: updateResult?.error || "Qwen Web trả về lỗi khi cập nhật settings.",
      }, { status: 400 });
    }
  } catch (err) {
    console.error("[report-assistant/settings/update] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi cập nhật Qwen Web" },
      { status: 500 }
    );
  }
}
