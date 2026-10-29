// 教師身分判斷規則（前端 client/src/lib/roles.js 使用相同規則，修改時請同步）：
// 1. 資料庫 Student.role === "teacher"（由 ADMIN_EMAILS 或手動設定）
// 2. 或 Clerk Organization 中的角色為 teacher / admin
export const TEACHER_ORG_ROLES = ["org:teacher", "teacher", "org:admin", "admin"];

export const isTeacherOrgRole = (role) => TEACHER_ORG_ROLES.includes(role);
