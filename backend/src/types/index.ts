export type UserRole = "admin" | "management" | "ultra" | "pro" | "plus" | "free";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
}

export interface Document {
  id: string;
  title: string;
  description: string;
  category_id: string;
  created_at: string;
  active: boolean;
  premium: boolean;
  category?: {
    title: string;
  } | null;
}

export interface Question {
  id: string;
  document_id: string;
  question: string;
  answer: string;
  choices: string[];
  url_question: string | null;
  url_answer: string | null;
  url_choices: string | null;
  order_index: number;
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  management: 90,
  ultra: 80,
  pro: 70,
  plus: 50,
  free: 10,
};

export const FREE_QUESTION_LIMIT = 5;
