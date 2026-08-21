import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import pricingRoutes from "./routes/pricingRoutes";
import serviceRoutes from "./routes/serviceRoutes";
import adminPricingRoutes from "./routes/adminPricingRoutes";
import adminServiceRoutes from "./routes/adminServiceRoutes";
import authRoutes from "./routes/authRoutes";
import auditRoutes from "./routes/auditRoutes";
import doctorRoutes, { adminDoctorRouter } from "./routes/doctorRoutes";
import { ensureAuditTable, ensureDoctorsTable } from "./config/database";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    message: "Hospital Costing API is running",
  });
});

app.use("/api/pricing", pricingRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin/pricing", adminPricingRoutes);
app.use("/api/admin/services", adminServiceRoutes);
app.use("/api/admin/audit-logs", auditRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/admin/doctors", adminDoctorRouter);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await ensureAuditTable();
    await ensureDoctorsTable();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize database schema:", error);
    process.exit(1);
  }
};

startServer();