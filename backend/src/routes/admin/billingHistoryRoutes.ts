import { Router } from "express";
import { getBillingHistory } from "../../controllers/admin/billingHistoryController";
import { authMiddleware, requireAdmin } from "../../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware, requireAdmin);
router.get("/", getBillingHistory);

export default router;
