import { Router } from "express";
import {
  getAllPricing,
  updatePricingRate,
} from "../controllers/adminPricingController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);
router.get("/", getAllPricing);
router.put("/:id", updatePricingRate);

export default router;
