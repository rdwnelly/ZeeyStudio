"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "Owner" | "Admin" | "Klien";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("Klien");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simulate network delay for premium feel
    setTimeout(() => {
      if (role === "Owner") {
        if (username === "owner" && password === "1234") {
          // In a real app, set an auth cookie/token here
          localStorage.setItem("zeey_auth_role", "owner");
          router.push("/owner");
        } else {
          setError("Username atau password salah untuk Owner.");
          setIsLoading(false);
        }
      } else if (role === "Admin") {
        // Check against the actual admins in localStorage
        const savedAdmins = JSON.parse(localStorage.getItem("zeey_admins") || "[]");
        const adminFound = savedAdmins.find((a: any) => a.username === username && a.password === password);
        
        if (adminFound) {
          localStorage.setItem("zeey_auth_role", "admin");
          localStorage.setItem("zeey_auth_user", adminFound.name);
          router.push("/admin");
        } else {
          setError("Username atau password salah untuk Admin.");
          setIsLoading(false);
        }
      } else if (role === "Klien") {
        if (projectId.trim().length > 0) {
          router.push(`/client/${projectId.trim()}`);
        } else {
          setError("ID Project tidak boleh kosong.");
          setIsLoading(false);
        }
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-3xl"></div>

      <div className="max-w-md w-full z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-serif mb-2 text-foreground">Zeey Studio</h1>
          <p className="text-foreground/60 font-sans tracking-wide">Portal Manajemen & Fotografi</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
          
          {/* Role Tabs */}
          <div className="flex border-b border-border">
            {(["Klien", "Admin", "Owner"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setError(""); }}
                className={`flex-1 py-4 text-sm font-sans font-medium transition-colors cursor-pointer ${
                  role === r 
                    ? "bg-accent text-white" 
                    : "bg-surface-alt text-foreground/60 hover:bg-surface hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="p-8">
            <h2 className="text-2xl font-serif mb-6 text-center">
              {role === "Klien" ? "Akses Galeri" : `Login ${role}`}
            </h2>

            <form onSubmit={handleLogin} className="space-y-5">
              {role === "Klien" ? (
                <div>
                  <label className="block text-sm font-medium mb-2 font-sans text-foreground/80">Kode Akses / ID Project</label>
                  <input 
                    type="text" 
                    required
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="Masukkan kode unik..."
                    className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:border-accent transition-colors font-sans"
                  />
                  <p className="text-xs text-foreground/50 mt-2 font-sans">Kode akses biasanya dikirimkan melalui WhatsApp.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2 font-sans text-foreground/80">Username</label>
                    <input 
                      type="text" 
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={role === "Owner" ? "owner" : "admin"}
                      className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:border-accent transition-colors font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 font-sans text-foreground/80">Password</label>
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:border-accent transition-colors font-sans"
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm font-sans animate-in fade-in">
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-accent text-white py-3.5 rounded-lg font-medium hover:bg-accent-dark transition-all duration-300 mt-2 shadow-md cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center font-sans"
              >
                {isLoading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  role === "Klien" ? "Buka Galeri" : "Masuk"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Demo credentials hint */}
        {role === "Owner" && (
          <div className="mt-6 text-center text-xs text-foreground/40 font-sans">
            <p>Demo Owner: owner / 1234</p>
          </div>
        )}
        {role === "Admin" && (
          <div className="mt-6 text-center text-xs text-foreground/40 font-sans">
            <p>Gunakan username & password yang dibuat di Portal Owner.</p>
            <p>Default: sarah / 123 atau john / 123</p>
          </div>
        )}
      </div>
    </div>
  );
}
