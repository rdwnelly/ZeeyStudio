"use client";

/** Satu baris status variabel lingkungan server (nilai rahasia tidak pernah ditampilkan). */
export function EnvVarRow({ name, ok, detail, optional }: { name: string; ok: boolean; detail?: string; optional?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-border/60 last:border-b-0">
      <div className="min-w-0">
        <code className="font-mono text-sm text-foreground break-all">{name}</code>
        {detail && <p className="text-xs text-foreground/60 mt-0.5 break-all">{detail}</p>}
      </div>
      <span
        className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
          ok ? "bg-green-500/10 text-green-600" : optional ? "bg-foreground/5 text-foreground/50" : "bg-red-500/10 text-red-600"
        }`}
      >
        {ok ? "✓ Terpasang" : optional ? "Opsional" : "Belum diatur"}
      </span>
    </div>
  );
}

export function EnvHelp() {
  return (
    <p className="text-xs text-foreground/60 leading-relaxed mt-4">
      Kunci rahasia hanya disimpan sebagai <strong>Environment Variables</strong> di server (Vercel → Project → Settings →
      Environment Variables), lalu lakukan <strong>Redeploy</strong>. Demi keamanan, kunci tidak dapat diisi atau dilihat dari
      dasbor dan tidak disimpan di database.
    </p>
  );
}
