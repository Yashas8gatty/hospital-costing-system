import { Router } from "express";
import { getAuditLogs } from "../controllers/auditController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);
router.get("/", getAuditLogs);

export default router;
