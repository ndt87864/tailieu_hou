-- SCRIPT TẠO DATABASE SCHEMA TRÊN SUPABASE (POSTGRESQL)
-- Copy và chạy script này trong giao diện SQL Editor của Supabase để khởi tạo cấu trúc dữ liệu tương thích.

-- 1. Bảng _meta
CREATE TABLE IF NOT EXISTS "_meta" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL
);

-- 2. Bảng settings
CREATE TABLE IF NOT EXISTS "settings" (
  "id" INTEGER PRIMARY KEY CHECK (id = 1),
  "data" JSONB NOT NULL
);

-- 3. Bảng providerConnections
CREATE TABLE IF NOT EXISTS "providerConnections" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "authType" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT,
  "priority" INTEGER,
  "isActive" BOOLEAN DEFAULT TRUE,
  "data" JSONB NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pc_provider ON "providerConnections"("provider");
CREATE INDEX IF NOT EXISTS idx_pc_provider_active ON "providerConnections"("provider", "isActive");
CREATE INDEX IF NOT EXISTS idx_pc_priority ON "providerConnections"("provider", "priority");

-- 4. Bảng providerNodes
CREATE TABLE IF NOT EXISTS "providerNodes" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT,
  "name" TEXT,
  "data" JSONB NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pn_type ON "providerNodes"("type");

-- 5. Bảng proxyPools
CREATE TABLE IF NOT EXISTS "proxyPools" (
  "id" TEXT PRIMARY KEY,
  "isActive" BOOLEAN DEFAULT TRUE,
  "testStatus" TEXT,
  "data" JSONB NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pp_active ON "proxyPools"("isActive");
CREATE INDEX IF NOT EXISTS idx_pp_status ON "proxyPools"("testStatus");

-- 6. Bảng apiKeys
CREATE TABLE IF NOT EXISTS "apiKeys" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT UNIQUE NOT NULL,
  "name" TEXT,
  "machineId" TEXT,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ak_key ON "apiKeys"("key");

-- 7. Bảng combos
CREATE TABLE IF NOT EXISTS "combos" (
  "username" TEXT NOT NULL DEFAULT 'admin',
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "kind" TEXT,
  "models" JSONB NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  CONSTRAINT "combos_username_name_key" UNIQUE ("username", "name")
);
CREATE INDEX IF NOT EXISTS idx_combo_name ON "combos"("name");
CREATE INDEX IF NOT EXISTS idx_combo_username_name ON "combos"("username", "name");

-- Existing projects created with the older global name constraint need this patch.
ALTER TABLE "combos" ADD COLUMN IF NOT EXISTS "username" TEXT NOT NULL DEFAULT 'admin';
UPDATE "combos" SET "username" = 'admin' WHERE "username" IS NULL OR btrim("username") = '';
ALTER TABLE "combos" ALTER COLUMN "username" SET DEFAULT 'admin';
ALTER TABLE "combos" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "combos" DROP CONSTRAINT IF EXISTS "combos_name_key";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'combos_username_name_key'
      AND conrelid = '"combos"'::regclass
  ) THEN
    ALTER TABLE "combos"
      ADD CONSTRAINT "combos_username_name_key" UNIQUE ("username", "name");
  END IF;
END $$;

-- 8. Bảng kv
CREATE TABLE IF NOT EXISTS "kv" (
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  PRIMARY KEY ("scope", "key")
);
CREATE INDEX IF NOT EXISTS idx_kv_scope ON "kv"("scope");

-- 9. Bảng usageHistory
CREATE TABLE IF NOT EXISTS "usageHistory" (
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
  "meta" JSONB
);
CREATE INDEX IF NOT EXISTS idx_uh_ts ON "usageHistory"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_uh_provider ON "usageHistory"("provider");
CREATE INDEX IF NOT EXISTS idx_uh_model ON "usageHistory"("model");
CREATE INDEX IF NOT EXISTS idx_uh_conn ON "usageHistory"("connectionId");

-- 10. Bảng usageDaily
CREATE TABLE IF NOT EXISTS "usageDaily" (
  "dateKey" TEXT PRIMARY KEY,
  "data" JSONB NOT NULL
);

-- 11. Bảng requestDetails
CREATE TABLE IF NOT EXISTS "requestDetails" (
  "id" TEXT PRIMARY KEY,
  "timestamp" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "connectionId" TEXT,
  "status" TEXT,
  "data" JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rd_ts ON "requestDetails"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_rd_provider ON "requestDetails"("provider");
CREATE INDEX IF NOT EXISTS idx_rd_model ON "requestDetails"("model");
CREATE INDEX IF NOT EXISTS idx_rd_conn ON "requestDetails"("connectionId");

-- 12. Tắt Row Level Security (RLS) để cho phép đồng bộ hóa dữ liệu trực tiếp qua API Key/Anon Key
ALTER TABLE "_meta" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "settings" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "providerConnections" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "providerNodes" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "proxyPools" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "apiKeys" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "combos" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "kv" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "usageHistory" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "usageDaily" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "requestDetails" DISABLE ROW LEVEL SECURITY;
