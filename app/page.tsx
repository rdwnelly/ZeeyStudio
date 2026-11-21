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
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // 1. Coba sebagai Owner bila yang diketik berbentuk email (Firebase Auth).
      //    Bila gagal JANGAN langsung berhenti: username admin boleh saja
      //    berbentuk email, jadi alurnya diteruskan ke pemeriksaan admin di bawah.
      let pesanOwner = "";
      const { auth } = await import("@/lib/firebase");
      if (username.includes("@")) {
        const { signInWithEmailAndPassword, signOut } = await import("firebase/auth");
        let masukFirebase = true;
        try {
          await signInWithEmailAndPassword(auth, username, password);
        } catch {
          masukFirebase = false;
          pesanOwner = "Email atau password salah.";
        }

        if (masukFirebase) {
          // Minta server memberi klaim peran "owner" (hanya untuk email di OWNER_EMAILS)
          const user = auth.currentUser!;
          const claimRes = await fetch("/api/auth/owner-claim", {
            method: "POST",
            headers: { Authorization: `Bearer ${await user.getIdToken()}` },
          });
          const claimData = await claimRes.json().catch(() => ({}));
          if (claimRes.ok && claimData.success) {
            if (claimData.refresh) await user.getIdToken(true); // muat ulang token dengan klaim baru

            localStorage.setItem("zeey_auth_role", "owner");
            localStorage.setItem("zeey_auth_user", "Owner");
            const { logActivity } = await import("@/lib/audit");
            await logActivity("Login", "Owner berhasil masuk via Firebase Auth.");
            router.push("/dashboard");
            return;
          }
          // Bukan Owner — keluarkan lagi, lalu coba sebagai admin
          await signOut(auth);
          pesanOwner = claimData.error || "Akun ini tidak terdaftar sebagai Owner.";
        }
      }

      // 2. Admin: diverifikasi di server (kata sandi di-hash, tidak dicocokkan dari browser)
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        // Masuk ke Firebase Auth dengan custom token berklaim peran & hak akses admin
        const { signInWithCustomToken } = await import("firebase/auth");
        await signInWithCustomToken(auth, data.customToken);
        // Pastikan ID token sudah siap sebelum pindah ke dasbor. Tanpa ini
        // halaman dasbor mulai membaca Firestore saat token admin belum ada,
        // koneksi Firestore gagal di awal lalu masuk jeda coba-ulang panjang
        // sehingga data tidak muncul sama sekali.
        await auth.currentUser?.getIdToken();

        localStorage.setItem("zeey_auth_role", "admin");
        localStorage.setItem("zeey_auth_access", JSON.stringify(data.accesses || []));
        localStorage.setItem("zeey_auth_user", data.name);

        const { logActivity } = await import("@/lib/audit");
        await logActivity("Login", `Admin ${data.name} berhasil masuk.`);
router.push("/dashboard");
      } else {
        setError(pesanOwner || data.error || "Username atau password salah.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Terjadi kesalahan saat menghubungi server.");
      setIsLoading(false);
    }
  };

  const inputCls =
    "w-full pl-11 pr-4 py-3 bg-surface-alt/60 border border-border/70 rounded-2xl text-sm text-foreground placeholder-foreground/35 transition-all";

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      {/* Gumpalan warna melayang */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-indigo-500/30 dark:bg-indigo-500/25 blur-3xl animate-float" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-pink-500/25 dark:bg-pink-500/20 blur-3xl animate-float [animation-delay:-3s]" />
        <div className="absolute -bottom-28 left-1/4 w-96 h-96 rounded-full bg-amber-400/25 dark:bg-amber-400/15 blur-3xl animate-float [animation-delay:-6s]" />
        <div className="absolute bottom-10 right-1/4 w-56 h-56 rounded-full bg-emerald-400/20 blur-3xl animate-float [animation-delay:-2s]" />
      </div>

      {/* Tombol tema */}
      <button
        onClick={toggleTheme}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 w-10 h-10 flex items-center justify-center rounded-full bg-surface/70 backdrop-blur-md border border-border/70 text-foreground/70 hover:text-accent transition-colors z-50 shadow-sm cursor-pointer press"
        title="Ganti tema"
        aria-label={theme === "dark" ? "Mode terang" : "Mode gelap"}
      >
        {theme === "dark" ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        )}
      </button>

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Merek */}
        <div className="text-center mb-7 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="relative mx-auto mb-5 w-16 h-16">
            <div className="absolute inset-0 rounded-[1.4rem] animate-aurora blur-md opacity-70" />
            <div className="relative w-16 h-16 rounded-[1.4rem] bg-brand text-white flex items-center justify-center shadow-xl shadow-violet-500/40">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Selamat Datang</h1>
          <p className="mt-1.5 text-sm text-foreground/55">
            Masuk ke <span className="font-semibold text-brand">Zeey Studio</span> Management
          </p>
        </div>

        {/* Kartu login */}
        <div className="relative rounded-[1.75rem] bg-surface/75 backdrop-blur-2xl border border-border/70 shadow-xl p-6 md:p-7 animate-in fade-in zoom-in-95 slide-in-from-bottom-6 duration-700">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-user" className="block text-xs font-semibold text-foreground/60 mb-1.5">Email Owner / Username Admin</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-violet-500">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </span>
                <input
                  id="login-user"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Email atau username"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label htmlFor="login-pass" className="block text-xs font-semibold text-foreground/60 mb-1.5">Kata Sandi</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-pink-500">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </span>
                <input
                  id="login-pass"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-foreground/40 hover:text-foreground/70 cursor-pointer"
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPassword ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.458 0C20.268 16.057 16.478 19 12 19s-8.268-2.943-9.542-7C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7z" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 rounded-2xl text-xs font-medium animate-in fade-in zoom-in-95 duration-300">
                <svg className="w-4 h-4 shrink-0 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full overflow-hidden bg-brand text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-violet-500/35 transition-all hover:shadow-xl hover:shadow-violet-500/40 hover:brightness-110 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 press"
            >
              <span className="absolute inset-y-0 -left-1/2 w-1/3 bg-white/25 skew-x-[-20deg] blur-sm transition-transform duration-700 group-hover:translate-x-[420%]" />
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Masuk ke Sistem
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-foreground/40 animate-in fade-in duration-1000">&copy; 2026 Zeey Studio. Dilindungi Hak Cipta.</p>
      </div>
    </div>
  );
}
