import { Router } from "express";
import {
  getAllPricing,
  updatePricingRate,
} from "../controllers/adminPricingController";
import { authMiddleware, requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware, requireAdmin);
router.get("/", getAllPricing);
router.put("/:id", updatePricingRate);

export default router;
