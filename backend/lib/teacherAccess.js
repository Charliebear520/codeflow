import Student from "../models/Student.js";
import { isDbReady, DB_UNAVAILABLE_MESSAGE } from "./db.js";
import { isTeacherOrgRole } from "./roles.js";

export function createRequireTeacher({ StudentModel = Student, dbReady = isDbReady } = {}) {
  return async (req, res, next) => {
    try {
      const auth = req.auth?.();
      if (!auth?.userId) return res.status(401).json({ success: false, error: "請先登入" });
      if (isTeacherOrgRole(auth.orgRole)) return next();
      if (!dbReady()) return res.status(503).json({ success: false, error: DB_UNAVAILABLE_MESSAGE });
      const student = await StudentModel.findOne({ userId: auth.userId }).lean();
      if (student?.role === "teacher") return next();
      return res.status(403).json({ success: false, error: "需要教師權限" });
    } catch { return res.status(500).json({ success: false, error: "無法驗證教師權限，請稍後再試" }); }
  };
}
export const requireTeacher = createRequireTeacher();
