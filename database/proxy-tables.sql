-- SQL SCRIPT KHỞI TẠO BẢNG QUẢN TRỊ PROXY, BÁO CÁO VÀ TRỢ LÝ (SUPABASE POSTGRESQL)

-- 1. Bảng _meta
CREATE TABLE IF NOT EXISTS public."_meta" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL
);

-- 2. Bảng settings (cấu hình proxy settings)
CREATE TABLE IF NOT EXISTS public."settings" (
  "id" INTEGER PRIMARY KEY CHECK (id = 1),
  "data" JSONB NOT NULL
);

-- 3. Bảng providerConnections
CREATE TABLE IF NOT EXISTS public."providerConnections" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "authType" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT,
  "priority" INTEGER,
  "isActive" BOOLEAN DEFAULT TRUE,
  "data" JSONB NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "username" TEXT NOT NULL DEFAULT 'admin'
);
CREATE INDEX IF NOT EXISTS idx_pc_provider ON public."providerConnections"("provider");
CREATE INDEX IF NOT EXISTS idx_pc_provider_active ON public."providerConnections"("provider", "isActive");
CREATE INDEX IF NOT EXISTS idx_pc_priority ON public."providerConnections"("provider", "priority");

-- 4. Bảng providerNodes
CREATE TABLE IF NOT EXISTS public."providerNodes" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT,
  "name" TEXT,
  "data" JSONB NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "username" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pn_type ON public."providerNodes"("type");

-- 5. Bảng proxyPools
CREATE TABLE IF NOT EXISTS public."proxyPools" (
  "id" TEXT PRIMARY KEY,
  "isActive" BOOLEAN DEFAULT TRUE,
  "testStatus" TEXT,
  "data" JSONB NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "username" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pp_active ON public."proxyPools"("isActive");
CREATE INDEX IF NOT EXISTS idx_pp_status ON public."proxyPools"("testStatus");

-- 6. Bảng apiKeys
CREATE TABLE IF NOT EXISTS public."apiKeys" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT UNIQUE NOT NULL,
  "name" TEXT,
  "machineId" TEXT,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TEXT NOT NULL,
  "username" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ak_key ON public."apiKeys"("key");
CREATE INDEX IF NOT EXISTS idx_ak_username ON public."apiKeys"("username");

-- 7. Bảng combos
CREATE TABLE IF NOT EXISTS public."combos" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "kind" TEXT,
  "models" JSONB NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  CONSTRAINT "combos_username_name_key" UNIQUE ("username", "name")
);
CREATE INDEX IF NOT EXISTS idx_combo_name ON public."combos"("name");
CREATE INDEX IF NOT EXISTS idx_combo_username_name ON public."combos"("username", "name");

-- 8. Bảng kv
CREATE TABLE IF NOT EXISTS public."kv" (
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  PRIMARY KEY ("scope", "key")
);
CREATE INDEX IF NOT EXISTS idx_kv_scope ON public."kv"("scope");

-- 9. Bảng usageHistory
CREATE TABLE IF NOT EXISTS public."usageHistory" (
  "id" BIGSERIAL PRIMARY KEY,
  "timestamp" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "connectionId" TEXT,
  "apiKey" TEXT,
  "endpoint" TEXT,
  "promptTokens" INTEGER DEFAULT 0,
  "completionTokens" INTEGER DEFAULT 0,
  "cost" DOUBLE PRECISION DEFAULT 0,
  "status" TEXT,
  "tokens" JSONB,
  "meta" JSONB,
  "username" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_uh_ts ON public."usageHistory"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_uh_provider ON public."usageHistory"("provider");
CREATE INDEX IF NOT EXISTS idx_uh_model ON public."usageHistory"("model");
CREATE INDEX IF NOT EXISTS idx_uh_conn ON public."usageHistory"("connectionId");

-- 10. Bảng usageDaily
CREATE TABLE IF NOT EXISTS public."usageDaily" (
  "dateKey" TEXT PRIMARY KEY,
  "data" JSONB NOT NULL
);

-- 11. Bảng requestDetails
CREATE TABLE IF NOT EXISTS public."requestDetails" (
  "id" TEXT PRIMARY KEY,
  "timestamp" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "connectionId" TEXT,
  "status" TEXT,
  "data" JSONB NOT NULL,
  "username" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rd_ts ON public."requestDetails"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_rd_provider ON public."requestDetails"("provider");
CREATE INDEX IF NOT EXISTS idx_rd_model ON public."requestDetails"("model");
CREATE INDEX IF NOT EXISTS idx_rd_conn ON public."requestDetails"("connectionId");

-- 12. Bảng scannerHistory (cho cụm trợ lý Document Scanner)
CREATE TABLE IF NOT EXISTS public."scannerHistory" (
  "id" TEXT PRIMARY KEY,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER,
  "fileType" TEXT,
  "ocrText" TEXT,
  "createdAt" TEXT NOT NULL,
  "username" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sh_created ON public."scannerHistory"("createdAt" DESC);

-- Disable Row Level Security (RLS) cho các bảng quản trị hệ thống
-- để tương thích với logic điều phối API bảo mật từ Hono backend
ALTER TABLE public."_meta" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."settings" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."providerConnections" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."providerNodes" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."proxyPools" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."apiKeys" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."combos" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."kv" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."usageHistory" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."usageDaily" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."requestDetails" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."scannerHistory" DISABLE ROW LEVEL SECURITY;
