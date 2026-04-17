import { Router, type Request, type Response, type NextFunction } from "express";
import { db, tagsTable } from "@workspace/db";

function requireApproved(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!user.isApproved && !user.isAdmin) { res.status(403).json({ error: "Account pending approval" }); return; }
  next();
}

const router = Router();

router.get("/", requireApproved, async (req, res) => {
  try {
    const tags = await db.select().from(tagsTable).orderBy(tagsTable.name);
    res.json(tags);
  } catch (err) {
    req.log.error({ err }, "Error listing tags");
    res.status(500).json({ error: "Failed to list tags" });
  }
});

export default router;
