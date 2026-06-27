import { supabaseAdmin } from "../config/db.js";
export const listDocuments = async () => {
    const { data, error } = await supabaseAdmin
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
    if (error)
        throw error;
    return data ?? [];
};
export const getDocumentById = async (id) => {
    const { data, error } = await supabaseAdmin
        .from("documents")
        .select("*")
        .eq("id", id)
        .single();
    if (error)
        return null;
    return data;
};
export const createDocument = async (doc) => {
    const { data, error } = await supabaseAdmin
        .from("documents")
        .insert(doc)
        .select()
        .single();
    if (error)
        throw error;
    return data;
};
export const updateDocument = async (id, updates) => {
    const { data, error } = await supabaseAdmin
        .from("documents")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
    if (error)
        return null;
    return data;
};
export const deleteDocument = async (id) => {
    const { error } = await supabaseAdmin
        .from("documents")
        .delete()
        .eq("id", id);
    return !error;
};
