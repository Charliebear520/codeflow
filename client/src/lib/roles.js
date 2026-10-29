import { useEffect, useState } from "react";
import { useAuth, useOrganization } from "@clerk/clerk-react";
import { readJson } from "./api";

// 教師身分判斷規則（後端 backend/lib/roles.js 使用相同規則，修改時請同步）：
// 1. Clerk Organization 中的角色為 teacher / admin
// 2. 或後端資料庫 Student.role === "teacher"（由 /api/me 取得）
export const TEACHER_ORG_ROLES = ["org:teacher", "teacher", "org:admin", "admin"];

export const isTeacherOrgRole = (role) => TEACHER_ORG_ROLES.includes(role);

// 同一頁面內共用一次 /api/me 結果，避免每個元件重複請求
let mePromise = null;

function fetchMeRole(getToken) {
  if (!mePromise) {
    mePromise = (async () => {
      const token = await getToken();
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson(res);
      return data?.me?.role || null;
    })().catch((err) => {
      console.error("取得使用者角色失敗:", err);
      mePromise = null; // 失敗時允許下次重試
      return null;
    });
  }
  return mePromise;
}

export function useIsTeacher() {
  const { isSignedIn, getToken } = useAuth();
  const { membership, isLoaded: isOrgLoaded } = useOrganization();
  const orgTeacher = isTeacherOrgRole(membership?.role);
  const [dbRole, setDbRole] = useState(undefined); // undefined = 尚未取得

  useEffect(() => {
    if (!isOrgLoaded || orgTeacher || !isSignedIn) return;
    let cancelled = false;
    fetchMeRole(getToken).then((role) => {
      if (!cancelled) setDbRole(role);
    });
    return () => {
      cancelled = true;
    };
  }, [isOrgLoaded, orgTeacher, isSignedIn, getToken]);

  if (!isOrgLoaded) return { isLoaded: false, isTeacher: false };
  if (orgTeacher) return { isLoaded: true, isTeacher: true };
  if (!isSignedIn) return { isLoaded: true, isTeacher: false };
  return { isLoaded: dbRole !== undefined, isTeacher: dbRole === "teacher" };
}
