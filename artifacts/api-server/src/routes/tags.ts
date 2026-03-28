import { Router } from "express";
import { db, tagsTable } from "@workspace/db";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const tags = await db.select().from(tagsTable).orderBy(tagsTable.name);
    res.json(tags);
  } catch (err) {
    req.log.error({ err }, "Error listing tags");
    res.status(500).json({ error: "Failed to list tags" });
  }
});

export default router;
