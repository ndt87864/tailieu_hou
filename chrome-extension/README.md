# Tailieu HOU Chrome Extension

Clone (viet lai) cua extension tailieu-ehou, ket noi backend Hono `tailieu_hou/backend`.

## Base URL
- Local: `http://localhost:3001/api/v1/*`
- Production: `https://tailieu-hou.onrender.com/api/v1/*`
- Auto-detect (mac dinh): thu local health, fail -> prod. Toggle trong popup.

## Cai dat
1. Copy `.env.example` -> `.env.extends`, dien `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
2. `chrome://extensions` -> Developer mode -> Load unpacked -> chon thu muc `chrome-extension/`.

## Scope (Core)
- Highlight dap an dung tren trang quiz EHOU/NEU/lmshub.
- Chon mon (document) theo ten khoa hoc.
- Lay cau hoi qua `GET /api/v1/questions/document/:id/limited`.
- Login Supabase Auth REST (email/password) -> luu JWT, gui header `Authorization: Bearer`.

## Bo trong scope core
- Batch-quiz multi-user, AI captcha/puter, 9router, sync subject/exam, user-capture EIHOU.

## Luồng
1. content.js inject -> courseDetector doc ten mon -> bg getDocumentByTitle.
2. Panel chon document -> getQuestionsByDocuments -> build index.
3. quizDetector parse cau hoi trang -> matcher match -> highlighter to dap an.
