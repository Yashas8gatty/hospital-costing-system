import { Router } from "express";
import {
  createService,
  getAllServices,
  updateService,
} from "../controllers/adminServiceController";

const router = Router();

router.get("/", getAllServices);
router.post("/", createService);
router.put("/:id", updateService);

export default router;
