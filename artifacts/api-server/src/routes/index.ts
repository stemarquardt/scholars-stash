import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import linksRouter from "./links";
import tagsRouter from "./tags";
import adminRouter from "./admin";
import analyzeRouter from "./analyze";
import suggestionsRouter from "./suggestions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/links", linksRouter);
router.use("/tags", tagsRouter);
router.use(adminRouter);
router.use("/ai", analyzeRouter);
router.use("/suggestions", suggestionsRouter);

export default router;
