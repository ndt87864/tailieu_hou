import { Hono } from "hono";
import { requireRole } from "../middlewares/role.js";
import * as docService from "../services/documentService.js";
import type { UserRole } from "../types/index.js";

const docsRouter = new Hono();

/** Trả về true nếu role là premium (plus/pro/ultra/management/admin) */
const isPremium = (role?: string): boolean =>
  ["plus", "pro", "ultra", "management", "admin"].includes(role ?? "");

docsRouter.get("/", async (c) => {
  try {
    const categoryId = c.req.query("category_id");
    // Lấy role từ JWT payload (được gắn bởi requireRole middleware hoặc middleware auth)
    const userRole = (c.get("role") as UserRole | undefined);
    const documents = await docService.listDocuments(categoryId, isPremium(userRole));
    return c.json({ documents });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

docsRouter.get("/grouped", async (c) => {
  try {
    const userRole = (c.get("role") as UserRole | undefined);
    const full = c.req.query("full") === "true";
    const categories = full
      ? await docService.getGroupedDocumentsFull(isPremium(userRole))
      : await docService.getGroupedDocumentsPreview(isPremium(userRole));
    return c.json({ categories });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

docsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const document = await docService.getDocumentById(id);
  if (!document) {
    return c.json({ error: "Document not found" }, 404);
  }
  return c.json({ document });
});

docsRouter.post("/", requireRole("management"), async (c) => {
  try {
    const body = await c.req.json();
    const { title, description, category_id } = body;
    const document = await docService.createDocument({ title, description, category_id });
    return c.json({ document }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

docsRouter.put("/:id", requireRole("management"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { title, description, category_id, active, premium } = body;
    const document = await docService.updateDocument(id, { title, description, category_id, active, premium });
    if (!document) {
      return c.json({ error: "Document not found or update failed" }, 404);
    }
    return c.json({ document });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

docsRouter.patch("/:id", requireRole("management"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const document = await docService.updateDocument(id, body);
    if (!document) {
      return c.json({ error: "Document not found or update failed" }, 404);
    }
    return c.json({ document });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

docsRouter.delete("/:id", requireRole("management"), async (c) => {
  const id = c.req.param("id");
  const success = await docService.deleteDocument(id);
  if (!success) {
    return c.json({ error: "Delete failed" }, 400);
  }
  return c.json({ success: true, message: "Document deleted successfully" });
});

export default docsRouter;
