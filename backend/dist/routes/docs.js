import { Hono } from "hono";
import { requireRole } from "../middlewares/role.js";
import * as docService from "../services/documentService.js";
const docsRouter = new Hono();
docsRouter.get("/", async (c) => {
    try {
        const documents = await docService.listDocuments();
        return c.json({ documents });
    }
    catch (error) {
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
        return c.json({ document }, 210);
    }
    catch (error) {
        return c.json({ error: error.message }, 400);
    }
});
docsRouter.put("/:id", requireRole("management"), async (c) => {
    try {
        const id = c.req.param("id");
        const body = await c.req.json();
        const { title, description, category_id } = body;
        const document = await docService.updateDocument(id, { title, description, category_id });
        if (!document) {
            return c.json({ error: "Document not found or update failed" }, 404);
        }
        return c.json({ document });
    }
    catch (error) {
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
