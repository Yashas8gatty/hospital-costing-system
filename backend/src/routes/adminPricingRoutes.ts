import { Router } from "express";
import {
  getAllPricing,
  updatePricingRate,
} from "../controllers/adminPricingController";

const router = Router();

router.get("/", getAllPricing);
router.put("/:id", updatePricingRate);

export default router;
