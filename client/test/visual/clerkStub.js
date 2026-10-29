// Only aliased by backend/test/visual-server.mjs, never imported by the app entry.
const auth = { getToken: async () => "visual-preview-only", userId:"visual-preview", isSignedIn:true };
export const useAuth = () => auth;
