import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

export const logActivity = async (action: string, details: string) => {
  try {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const user = localStorage.getItem("zeey_auth_user") || "Unknown User";
    const role = localStorage.getItem("zeey_auth_role") || "unknown";

    await addDoc(collection(db, "audit_logs"), {
      user,
      role,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
