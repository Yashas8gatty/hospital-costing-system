import { Router } from "express";
import { createUser, getUsers, updateUser } from "../controllers/userController";
import { authMiddleware, requireAdmin } from "../middleware/authMiddleware";

const router = Router();
router.use(authMiddleware, requireAdmin);
router.get("/", getUsers);
router.post("/", createUser);
router.put("/:id", updateUser);

export default router;
