import { Router } from "express";
import { getActiveServices } from "../controllers/serviceController";

const router = Router();

router.get("/", getActiveServices);

export default router;
