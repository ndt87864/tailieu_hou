/**
 * Helper functions for draftNext.js to reduce file size and improve maintainability
 */

import { normalizeOutlineMatchText } from "./utils";

/**
 * Sanitize Section IV content for Career Orientation Reports
 * Handles special formatting requirements for sections 4.1, 4.2, and 4.3
 * 
 * @param {string} draftResult - The draft content to sanitize
 * @param {Object} nextToDraft - The current section being drafted
 * @param {Object} currentState - The current agent state
 * @returns {string} The sanitized draft result
 */
export function sanitizeCareerSectionIV(draftResult, nextToDraft, currentState) {
  if (!draftResult) return draftResult;

  const isSectionIV = /xac\s+nhan\s+cua\s+can\s+bo\s+huong\s+dan/i.test(normalizeOutlineMatchText(nextToDraft.title)) ||
                      /4\.[123]\b/.test(normalizeOutlineMatchText(nextToDraft.title)) ||
                      (nextToDraft.parent_id && currentState.outline.some(p => p.id === nextToDraft.parent_id && /xac\s+nhan/i.test(normalizeOutlineMatchText(p.title))));
  
  const isSection43 = /4\.3\b/.test(normalizeOutlineMatchText(nextToDraft.title)) || /danh\s*gia/i.test(normalizeOutlineMatchText(nextToDraft.title));

  if (!isSectionIV) return draftResult;

  if (isSection43) {
    return sanitizeSection43(draftResult);
  } else {
    return sanitizeSection41_42(draftResult);
  }
}

/**
 * Sanitize Section 4.3 content - signature table handling
 */
function sanitizeSection43(draftResult) {
  const lines = draftResult.split("\n");
  const cleanLines = [];
  let seenSignatureTable = false;
  let stopKeeping = false;
  
  for (let line of lines) {
    const trimmed = line.trim();
    if (stopKeeping) {
      continue;
    }
    if (trimmed.startsWith("|") && /c[áâ]n\s+bộ\s+hướng\s+dẫn|người\s+xác\s+nhận/i.test(trimmed)) {
      seenSignatureTable = true;
    }
    if (seenSignatureTable && !trimmed.startsWith("|") && trimmed !== "") {
      stopKeeping = true;
      continue;
    }
    cleanLines.push(line);
  }
  return cleanLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Sanitize Section 4.1 & 4.2 content - table and form handling
 */
function sanitizeSection41_42(draftResult) {
  const lines = draftResult.split("\n");
  let inTable = false;
  let inCenter = false;
  let keepAll = false;
  const cleanLines = [];
  
  for (let line of lines) {
    const trimmed = line.trim();
    
    // If we see the national motto or center title, disable stripping from here onwards
    if (/cộng\s+hòa\s+xã\s+hội|cong\s+hoa\s+xa\s+hoi/i.test(trimmed)) {
      keepAll = true;
    }
    
    if (keepAll) {
      cleanLines.push(line);
      continue;
    }

    if (trimmed.startsWith("|")) {
      inTable = true;
      cleanLines.push(line);
      continue;
    }
    if (inTable && !trimmed.startsWith("|")) {
      inTable = false;
    }
    if (trimmed.toLowerCase().includes("<center>")) {
      inCenter = true;
      cleanLines.push(line);
      continue;
    }
    if (trimmed.toLowerCase().includes("</center>")) {
      inCenter = false;
      cleanLines.push(line);
      continue;
    }
    if (inCenter) {
      cleanLines.push(line);
      continue;
    }
    // Keep headings, bold labels, signature lines, short bullet lines, and lines starting with numbers/TT
    if (
      trimmed.startsWith("#") ||
      trimmed.startsWith("**") ||
      trimmed.startsWith("*") ||
      /^(?:\d+|[IVXLCDM]+)\./i.test(trimmed) ||
      /^Tôi\s+là/i.test(trimmed) ||
      trimmed === ""
    ) {
      cleanLines.push(line);
    }
  }
  return cleanLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Normalize signature table format in Section IV
 */
export function normalizeSignatureTable(draftResult) {
  if (!draftResult) return draftResult;
  return draftResult.replace(/\|\s*([^\n|]*?xác\s+nhận\s+của\s+cơ\s+quan[^\n|]*?)\s*\|/gi, "| **XÁC NHẬN CỦA CƠ QUAN**<br>*(Kí tên và đóng dấu)* |");
}

/**
 * Check if the report run has been cancelled and throw AGENT_CANCELLED error if so
 */
export async function throwIfCancelled(getAgentState, chatId, username) {
  const { data: latestState } = await getAgentState(chatId, username);
  if (latestState?.current_step === "CANCELLED") {
    const cancelledErr = new Error("AGENT_CANCELLED");
    cancelledErr.code = "AGENT_CANCELLED";
    cancelledErr.cancelledState = latestState;
    throw cancelledErr;
  }
}

/**
 * Helper wrapper for checking lease validity and cancellation status
 */
export async function checkPreconditions(leaseManager, getAgentState, chatId, username) {
  await leaseManager.verify();
  await throwIfCancelled(getAgentState, chatId, username);
}

/**
 * Reset Luna session context parameters for retry attempts
 */
export function retryWithFreshLunaChat(reportSession, stateToSave) {
  reportSession.lunaChatId = "";
  reportSession.lunaMessageId = "";
  const applyClear = (reportContext) => {
    if (!reportContext || typeof reportContext !== "object") return reportContext;
    return { ...reportContext, lunaChatId: "", lunaMessageId: "" };
  };
  if (Array.isArray(stateToSave.outline)) {
    stateToSave.outline = stateToSave.outline.map((item) => item && typeof item === "object"
      ? { ...item, reportContext: applyClear(item.reportContext) }
      : item);
  }
  if (Array.isArray(stateToSave.sections_progress)) {
    stateToSave.sections_progress = stateToSave.sections_progress.map((item) => item && typeof item === "object"
      ? { ...item, reportContext: applyClear(item.reportContext) }
      : item);
  }
}

