import { Router } from "express";
import multer from "multer";
import {
	createCalculation,
	finalizeCalculation,
	getCalculation,
	getCalculationPdf,
	uploadResultImage,
	removeResultImage,
	getResultImage,
} from "../controllers/calculationController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

router.post("/", createCalculation);
router.get("/:id", getCalculation);
router.put("/:id/finalize", finalizeCalculation);
router.get("/:id/pdf", getCalculationPdf);

router.post("/:id/result-image", upload.single("image"), uploadResultImage);
router.delete("/:id/result-image", removeResultImage);
router.get("/:id/result-image", getResultImage);

export default router;