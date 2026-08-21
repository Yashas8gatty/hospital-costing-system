import { Router } from "express";
import {
	createCalculation,
	finalizeCalculation,
	getCalculation,
	getCalculationPdf,
} from "../controllers/calculationController";

const router = Router();

router.post("/", createCalculation);
router.get("/:id", getCalculation);
router.put("/:id/finalize", finalizeCalculation);
router.get("/:id/pdf", getCalculationPdf);

export default router;