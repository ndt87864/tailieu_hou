import { getRestrictedReportAssistantSubjects } from "@/lib/userResourceMapping";

export const FALLBACK_SYSTEM_PROMPT = "";

export function getAssistantOnlyFallbackPrompt(username) {
  const displayName = String(username || "người dùng").trim() || "người dùng";
  return `Bạn là một trợ lý AI thân thiện. Hãy trả lời bằng tiếng Việt tự nhiên, rõ ràng và dễ hiểu. Nếu người dùng không yêu cầu tạo báo cáo, hãy trò chuyện như một trợ lý bình thường, giúp giải đáp thắc mắc và hướng dẫn từng bước.
- Khi giao tiếp, hãy xưng danh, xưng hô phù hợp với vai trò của trợ lý đang phục vụ tài khoản đó.
- Nếu người dùng hỏi về dnah tính của họ hoặc tương tự, hãy trả lời theo tên tài khoản đang đăng nhập là "${displayName}".
- Không tự nhận là người khác, không đổi danh xưng sang model/provider khác.`;
}

export const DEFAULT_TEMPERATURE = 0.7;
export const REPORT_MAX_TOKENS = 4096;
export const CHAT_MAX_TOKENS = 2048;
export const OUTLINE_MAX_TOKENS = 2048;
export const MAX_OUTLINE_CONTEXT_CHARS = 6000;
export const MAX_STAGE_CONTEXT_CHARS = 6000;
export const REPORT_KNOWLEDGE_GLOBAL_USER = "global";
export const REPORT_OUTLINE_CONTENT_USER = `report_assistant_outlines_${REPORT_KNOWLEDGE_GLOBAL_USER}`;
export const REPORT_TEMPLATE_CONTENT_USER = `report_assistant_templates_${REPORT_KNOWLEDGE_GLOBAL_USER}`;
export const RESTRICTED_REPORT_ASSISTANT_SUBJECTS = getRestrictedReportAssistantSubjects();
export const MAX_GLOBAL_OUTLINE_KNOWLEDGE_CHARS = 14000;
export const MAX_SAMPLE_KNOWLEDGE_CHARS = 18000;
export const SAMPLE_CHUNK_CHARS = 1800;
export const SAMPLE_TOP_K = 8;
export const KNOWLEDGE_CACHE_PREFIX = "report-assistant.knowledge-content.";
export const KNOWLEDGE_SESSION_OWNER_KEY = "report-assistant.knowledge-content.sessionOwner";
export const REPORT_ASSISTANT_LUNA_MODEL_PREFIX = "ln/";
export const A4_PAGE_WIDTH = "8.27in";
export const A4_PAGE_HEIGHT = "11.69in";
export const A4_MARGIN_TOP = "2.5cm";
export const A4_MARGIN_RIGHT = "2cm";
export const A4_MARGIN_BOTTOM = "2.5cm";
export const A4_MARGIN_LEFT = "3cm";

export const getSK = (username) => {
  const prefix = `report-assistant.${username}`;
  return {
    sessions: `${prefix}.sessions`,
    activeSession: `${prefix}.activeSession`,
    activeModel: `${prefix}.activeModel`,
    systemPrompt: `${prefix}.systemPrompt`,
    temperature: `${prefix}.temperature`,
    enabledModels: `${prefix}.enabledModels`,
    knownModels: `${prefix}.knownModels`,
    knowledgeSubject: `${prefix}.knowledgeSubject`,
    assistantOnlyMode: `${prefix}.assistantOnlyMode`,
    webSearchEnabled: `${prefix}.webSearchEnabled`,
    streamEnabled: `${prefix}.streamEnabled`,
    thinkingMode: `${prefix}.thinkingMode`,
  };
};

export const REPORT_TYPES = [
  {
    id: "b49",
    name: "Báo cáo thực tập B49",
    description: "Mẫu báo cáo dành cho sinh viên khóa B49 thực tập doanh nghiệp (phân tích, đề xuất giải pháp, thiết kế, triển khai).",
    outlineUrl: "/report-templates/outline-b49.md",
    docUrl: "/report-templates/template-b49.md",
    ragSubject: "b49"
  },
  {
    id: "standard",
    name: "Báo cáo khoa học tiêu chuẩn",
    description: "Mẫu báo cáo khoa học, chuyên luận hoặc báo cáo học thuật tiêu chuẩn với cấu trúc 5 chương.",
    outlineUrl: "/report-templates/outline-standard.md",
    docUrl: "/report-templates/template-standard.md",
    ragSubject: "standard"
  },
  {
    id: "career",
    name: "Tiểu luận Định hướng nghề nghiệp",
    description: "Báo cáo định hướng nghề nghiệp, tự luận bản thân dành cho sinh viên.",
    outlineUrl: "/report-templates/outline-career.md",
    docUrl: "/report-templates/template-career.md",
    ragSubject: "career"
  }
];
