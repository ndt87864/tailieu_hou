import { supabaseAdmin } from "../config/db.js";
export const getQuestionsByDocument = async (documentId) => {
    const { data, error } = await supabaseAdmin
        .from("questions")
        .select("*")
        .eq("document_id", documentId)
        .order("order_index", { ascending: true });
    if (error)
        throw error;
    return data ?? [];
};
export const createQuestion = async (q) => {
    const { data, error } = await supabaseAdmin
        .from("questions")
        .insert(q)
        .select()
        .single();
    if (error)
        throw error;
    return data;
};
export const updateQuestion = async (id, updates) => {
    const { data, error } = await supabaseAdmin
        .from("questions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
    if (error)
        return null;
    return data;
};
export const deleteQuestion = async (id) => {
    const { error } = await supabaseAdmin
        .from("questions")
        .delete()
        .eq("id", id);
    return !error;
};
export const getQuestionById = async (id) => {
    const { data, error } = await supabaseAdmin
        .from("questions")
        .select("*")
        .eq("id", id)
        .single();
    if (error)
        return null;
    return data;
};
