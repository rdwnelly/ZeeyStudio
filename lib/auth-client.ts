/**
 * Utilitas autentikasi di browser untuk dasbor staf.
 */
import { auth } from "@/lib/firebase";

/** ID token Firebase pengguna yang sedang login (null bila belum login). */
export async function getIdTokenSafe(): Promise<string | null> {
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

/** fetch() yang otomatis menyertakan header Authorization: Bearer <ID token>. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getIdTokenSafe();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export function clearLocalSession() {
  localStorage.removeItem("zeey_auth_role");
  localStorage.removeItem("zeey_auth_access");
  localStorage.removeItem("zeey_auth_user");
}
