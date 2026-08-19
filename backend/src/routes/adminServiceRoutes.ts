import { Router } from "express";
import {
  createService,
  getAllServices,
  updateService,
} from "../controllers/adminServiceController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);
router.get("/", getAllServices);
router.post("/", createService);
router.put("/:id", updateService);

export default router;
