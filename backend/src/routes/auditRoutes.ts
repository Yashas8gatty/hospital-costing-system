import { Router } from "express";
import { getAuditLogs } from "../controllers/auditController";
import { authMiddleware, requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware, requireAdmin);
router.get("/", getAuditLogs);

export default router;
