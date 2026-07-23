"use client";

import { useState, useCallback, useMemo } from "react";
import {
  REPORT_KNOWLEDGE_GLOBAL_USER,
  RESTRICTED_REPORT_ASSISTANT_SUBJECTS,
} from "../constants";

export function useKnowledgeBase({
  username,
  isRestrictedUser,
}) {
  const [subjectsOutlines, setSubjectsOutlines] = useState([]);
  const [filesOutlines, setFilesOutlines] = useState({});
  const [loadingOutlines, setLoadingOutlines] = useState(false);
  const [subjectsTemplates, setSubjectsTemplates] = useState([]);
  const [filesTemplates, setFilesTemplates] = useState({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const isSupabaseConfigured = useMemo(() => {
    return !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
  }, []);

  const loadOutlines = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoadingOutlines(true);
    try {
      const res = await fetch(
        `/api/report-assistant/knowledge?username=${encodeURIComponent(REPORT_KNOWLEDGE_GLOBAL_USER)}&type=outlines`
      );
      const data = await res.json();
      const subjects = Array.isArray(data.subjects) ? data.subjects : [];
      const filesBySubject = data.filesBySubject || {};
      if (isRestrictedUser) {
        const allowed = {};
        for (const subj of RESTRICTED_REPORT_ASSISTANT_SUBJECTS) {
          allowed[subj] = Array.isArray(filesBySubject[subj]) ? filesBySubject[subj] : [];
        }
        setSubjectsOutlines([...RESTRICTED_REPORT_ASSISTANT_SUBJECTS]);
        setFilesOutlines(allowed);
      } else {
        setSubjectsOutlines(subjects);
        setFilesOutlines(filesBySubject);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOutlines(false);
    }
  }, [isSupabaseConfigured, isRestrictedUser]);

  const loadTemplates = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoadingTemplates(true);
    try {
      const res = await fetch(
        `/api/report-assistant/knowledge?username=${encodeURIComponent(REPORT_KNOWLEDGE_GLOBAL_USER)}&type=templates`
      );
      const data = await res.json();
      const subjects = Array.isArray(data.subjects) ? data.subjects : [];
      const filesBySubject = data.filesBySubject || {};
      if (isRestrictedUser) {
        const allowed = {};
        for (const subj of RESTRICTED_REPORT_ASSISTANT_SUBJECTS) {
          allowed[subj] = Array.isArray(filesBySubject[subj]) ? filesBySubject[subj] : [];
        }
        setSubjectsTemplates([...RESTRICTED_REPORT_ASSISTANT_SUBJECTS]);
        setFilesTemplates(allowed);
      } else {
        setSubjectsTemplates(subjects);
        setFilesTemplates(filesBySubject);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTemplates(false);
    }
  }, [isSupabaseConfigured, isRestrictedUser]);

  const allSubjects = useMemo(() => {
    if (isRestrictedUser) return [...RESTRICTED_REPORT_ASSISTANT_SUBJECTS];
    const set = new Set([
      ...Object.keys(filesOutlines || {}),
      ...Object.keys(filesTemplates || {}),
    ]);
    return Array.from(set).filter(Boolean);
  }, [filesOutlines, filesTemplates, isRestrictedUser]);

  return {
    subjectsOutlines,
    filesOutlines,
    loadingOutlines,
    loadOutlines,
    subjectsTemplates,
    filesTemplates,
    loadingTemplates,
    loadTemplates,
    allSubjects,
    isSupabaseConfigured,
  };
}
