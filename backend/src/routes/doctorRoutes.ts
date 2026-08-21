import { Router } from "express";
import {
	createDoctor,
	getAllDoctors,
	getDoctors,
	updateDoctor,
} from "../controllers/doctorController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();
export const adminDoctorRouter = Router();

router.get("/", getDoctors);

adminDoctorRouter.use(authMiddleware);
adminDoctorRouter.get("/", getAllDoctors);
adminDoctorRouter.post("/", createDoctor);
adminDoctorRouter.put("/:id", updateDoctor);

export default router;