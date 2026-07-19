import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock tursoClient
vi.mock("../../src/lib/tursoClient", () => {
  return {
    turso: {
      execute: vi.fn(),
    },
  };
});

import { __test__ } from "../../src/app/api/report-assistant/agent/route.js";
import { turso } from "../../src/lib/tursoClient";

const { saveAgentState } = __test__;

describe("report assistant security and concurrency control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saveAgentState performs INSERT (upsert) when expectedUpdatedAt is not provided", async () => {
    turso.execute.mockResolvedValue({ rowsAffected: 1 });

    const stateData = {
      current_step: "DRAFTING",
      current_activity: { message: "Running" },
      outline: [],
      sections_progress: [],
    };

    await saveAgentState("chat-123", "admin", stateData);

    expect(turso.execute).toHaveBeenCalled();
    const lastCall = turso.execute.mock.lastCall[0];
    expect(lastCall.sql).toContain("INSERT INTO report_agent_states");
  });

  it("saveAgentState performs UPDATE with WHERE clause when expectedUpdatedAt is a string", async () => {
    turso.execute.mockResolvedValue({ rowsAffected: 1 });

    const stateData = {
      current_step: "DRAFTING",
      current_activity: { message: "Running" },
      outline: [],
      sections_progress: [],
    };

    const expectedTime = "2026-07-18T00:00:00.000Z";
    await saveAgentState("chat-123", "admin", stateData, expectedTime);

    expect(turso.execute).toHaveBeenCalled();
    const lastCall = turso.execute.mock.lastCall[0];
    expect(lastCall.sql).toContain("UPDATE report_agent_states");
    expect(lastCall.sql).toContain("WHERE chat_id = ? AND username = ? AND updated_at = ?");
    expect(lastCall.args).toContain(expectedTime);
  });

  it("saveAgentState throws concurrency conflict when rowsAffected is 0 under optimistic lock", async () => {
    turso.execute.mockResolvedValue({ rowsAffected: 0 });

    const stateData = {
      current_step: "DRAFTING",
    };

    await expect(
      saveAgentState("chat-123", "admin", stateData, "2026-07-18T00:00:00.000Z")
    ).rejects.toThrow("Concurrency conflict");
  });

  it("saveAgentState checks lease EXISTS when lockId is provided without expectedUpdatedAt", async () => {
    turso.execute.mockResolvedValue({ rowsAffected: 1 });

    const stateData = {
      current_step: "DRAFTING",
      current_activity: { message: "Running" },
      outline: [],
      sections_progress: [],
    };

    const lockId = "lock-456";
    await saveAgentState("chat-123", "admin", stateData, null, lockId);

    expect(turso.execute).toHaveBeenCalled();
    const lastCall = turso.execute.mock.lastCall[0];
    expect(lastCall.sql).toContain("EXISTS (");
    expect(lastCall.sql).toContain("report_agent_worker_leases");
    expect(lastCall.args).toContain(lockId);
  });
});
