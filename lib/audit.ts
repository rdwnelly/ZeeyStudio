import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

export const logActivity = async (action: string, details: string): Promise<void> => {
  try {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const user = localStorage.getItem("zeey_auth_user") || "Unknown User";
    const role = localStorage.getItem("zeey_auth_role") || "unknown";

    // Jangan tunggu konfirmasi server: bila koneksi Firestore bermasalah,
    // promise addDoc bisa menggantung dan menahan alur login.
    void addDoc(collection(db, "audit_logs"), {
      user,
      role,
      action,
      details,
      timestamp: new Date().toISOString()
    }).catch((err) => console.error("Gagal menulis audit log:", err));
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
