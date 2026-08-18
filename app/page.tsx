"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // 1. Check for Owner using Firebase Auth (Email/Password)
      if (username.includes("@")) {
        const { auth } = await import("@/lib/firebase");
        const { signInWithEmailAndPassword } = await import("firebase/auth");
        try {
          await signInWithEmailAndPassword(auth, username, password);
          localStorage.setItem("zeey_auth_role", "owner");
          localStorage.setItem("zeey_auth_user", "Owner");
          const { logActivity } = await import("@/lib/audit");
          await logActivity("Login", "Owner berhasil masuk via Firebase Auth.");
          router.push("/dashboard");
          return;
        } catch (authErr: any) {
          setError("Email atau password salah.");
          setIsLoading(false);
          return;
        }
      }

      // 2. Check Firestore for Admins
      const { collection, getDocs, query, where } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");

      const q = query(
        collection(db, "admins"),
        where("username", "==", username),
        where("password", "==", password)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const adminDoc = querySnapshot.docs[0].data();
        const authRole = adminDoc.role || "admin";

        let accesses = adminDoc.accesses;
        if (!accesses) {
          accesses = authRole === "admin_editor" ? ["editor", "portfolio"] : ["bookings", "portfolio"];
        }

        localStorage.setItem("zeey_auth_role", "admin");
        localStorage.setItem("zeey_auth_access", JSON.stringify(accesses));
        localStorage.setItem("zeey_auth_user", adminDoc.name);

        const { logActivity } = await import("@/lib/audit");
        await logActivity("Login", `Admin ${adminDoc.name} berhasil masuk.`);
        router.push("/dashboard");
      } else {
        setError("Username atau password salah.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Terjadi kesalahan saat menghubungi server.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">

      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-3 rounded-full bg-surface/50 backdrop-blur-sm border border-border text-foreground hover:bg-surface-alt transition-all z-50 shadow-sm cursor-pointer"
        title="Toggle Theme"
      >
        {theme === 'dark' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        )}
      </button>

      {/* Premium Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-purple-900/10 dark:bg-purple-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-accent/5 dark:bg-accent/10 rounded-full blur-[100px]"></div>
        <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] bg-blue-900/10 dark:bg-blue-900/20 rounded-full blur-[80px]"></div>
      </div>

      <div className="max-w-[420px] w-full z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        {/* Brand Header */}
        <div className="text-center mb-10">
          <div className="inline-block p-1 px-4 border border-border rounded-full bg-surface-alt/50 backdrop-blur-md mb-6 shadow-sm">
            <p className="text-xs font-sans tracking-[0.2em] text-foreground/70 uppercase">Zeey Studio Management</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-foreground tracking-tight">Selamat Datang</h1>
        </div>

        {/* Glassmorphism Login Card */}
        <div className="bg-surface/50 backdrop-blur-2xl border border-border rounded-3xl shadow-xl overflow-hidden relative">

          {/* Subtle top glare */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-foreground/20 to-transparent"></div>

          <div className="p-8 md:p-10">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-500">
                <div>
                  <label className="block text-xs font-sans tracking-wider text-foreground/50 uppercase mb-2">Email Owner / Username Admin</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Email atau username..."
                      className="w-full pl-11 pr-5 py-4 bg-background/50 border border-border rounded-xl text-foreground placeholder-foreground/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all font-sans"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-sans tracking-wider text-foreground/50 uppercase mb-2">Kata Sandi</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-11 pr-5 py-4 bg-background/50 border border-border rounded-xl text-foreground placeholder-foreground/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all font-sans"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-sans text-center animate-in zoom-in-95 duration-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-foreground text-background py-4 rounded-xl font-bold tracking-wide hover:bg-foreground/80 transition-all duration-300 mt-4 shadow-[0_0_20px_rgba(var(--foreground-rgb),0.1)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center font-sans"
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5 text-background" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  "Masuk ke Sistem"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Demo/Help Text underneath */}
        <div className="mt-8 text-center animate-in fade-in duration-1000 delay-500">
          <p className="text-xs font-sans text-foreground/30">
            &copy; 2026 Zeey Studio. Dilindungi Hak Cipta.
          </p>
        </div>
      </div>
    </div>
  );
}

