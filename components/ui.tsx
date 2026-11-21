"use client";

import { useEffect, useRef, useState } from "react";
import { MODULE_BY_ID, type ModuleId } from "@/lib/nav-modules";

/** Ikon garis (stroke) dari path SVG 24×24. */
export function Icon({ d, className = "w-5 h-5", strokeWidth = 2 }: { d: string; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d={d} />
    </svg>
  );
}

/** Ubin ikon bergradasi sesuai warna modul. */
export function ModuleIcon({ id, size = "md" }: { id: ModuleId; size?: "sm" | "md" | "lg" }) {
  const m = MODULE_BY_ID[id];
  const box = size === "sm" ? "w-8 h-8 rounded-xl" : size === "lg" ? "w-12 h-12 rounded-2xl" : "w-10 h-10 md:w-11 md:h-11 rounded-2xl";
  const ico = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";
  return (
    <span className={`${box} ${m.gradient} shadow-lg ${m.glow} text-white flex items-center justify-center shrink-0`}>
      <Icon d={m.icon} className={ico} strokeWidth={2.2} />
    </span>
  );
}

/**
 * Header halaman yang ringkas: ubin ikon berwarna, judul, subjudul, dan aksi di kanan.
 * Di HP aksi turun ke baris bawah dan melebar penuh.
 */
export function PageHeader({
  module,
  title,
  subtitle,
  actions,
  children,
}: {
  module: ModuleId;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-5 md:mb-7 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ModuleIcon id={module} />
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">{title}</h1>
            {subtitle && <p className="text-xs md:text-sm text-foreground/55 mt-0.5 leading-snug">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

/** Angka yang "menghitung naik" saat pertama tampil. */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    if (reduce || !Number.isFinite(target)) {
      from.current = target;
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = start + (target - start) * eased;
      setValue(p < 1 ? v : target);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const TONES = {
  violet: { chip: "bg-violet-500/12 text-violet-600 dark:text-violet-400", bar: "from-violet-500 to-indigo-500" },
  pink: { chip: "bg-pink-500/12 text-pink-600 dark:text-pink-400", bar: "from-pink-500 to-rose-500" },
  amber: { chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400", bar: "from-amber-400 to-orange-500" },
  emerald: { chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", bar: "from-emerald-500 to-teal-500" },
  sky: { chip: "bg-sky-500/12 text-sky-600 dark:text-sky-400", bar: "from-sky-500 to-blue-600" },
  fuchsia: { chip: "bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-400", bar: "from-purple-500 to-fuchsia-500" },
} as const;
export type Tone = keyof typeof TONES;

/** Kartu KPI ringkas: ikon berwarna, angka beranimasi, keterangan kecil. */
export function StatCard({
  label,
  value,
  format = (n) => Math.round(n).toLocaleString("id-ID"),
  hint,
  icon,
  tone = "violet",
  highlight = false,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  hint?: string;
  icon: string;
  tone?: Tone;
  highlight?: boolean;
}) {
  const v = useCountUp(value);
  const t = TONES[tone];
  if (highlight) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-aurora p-4 md:p-5 text-white shadow-xl shadow-violet-500/25 lift">
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/15 blur-xl animate-float" />
        <div className="relative flex items-center justify-between">
          <p className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wide text-white/85 leading-tight">{label}</p>
          <span className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Icon d={icon} className="w-4 h-4" />
          </span>
        </div>
        <p className="relative mt-3 text-2xl md:text-3xl font-extrabold tracking-tight tabular-nums break-words">{format(v)}</p>
        {hint && <p className="relative mt-1 text-[11px] md:text-xs text-white/80">{hint}</p>}
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-3xl bg-surface border border-border/70 p-4 md:p-5 shadow-sm lift">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.bar} opacity-80`} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wide text-foreground/50 leading-tight">{label}</p>
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${t.chip}`}>
          <Icon d={icon} className="w-4 h-4" />
        </span>
      </div>
      <p className="mt-3 text-xl sm:text-2xl md:text-[1.7rem] font-extrabold tracking-tight tabular-nums text-foreground break-words">{format(v)}</p>
      {hint && <p className="mt-1 text-[11px] md:text-xs text-foreground/50">{hint}</p>}
    </div>
  );
}

/** Kerangka pemuatan berkilau. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-2xl ${className}`} />;
}

/** Gaya seragam untuk seluruh kolom isian. */
export const INPUT =
  "w-full px-3.5 py-2.5 rounded-xl bg-surface-alt/50 border border-border/70 text-sm text-foreground placeholder-foreground/35 transition-all";

/** Satu kartu pada kisi bento: ubin ikon berwarna + judul + isi. */
export function BentoCard({
  tone,
  glow,
  icon,
  title,
  desc,
  className = "",
  children,
}: {
  tone: string;
  glow: string;
  icon: string;
  title: string;
  desc?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-3xl bg-surface border border-border/70 shadow-sm p-4 md:p-5 lift ${className}`}>
      <header className="flex items-center gap-2.5 mb-4">
        <span className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${tone} ${glow} shadow-lg text-white flex items-center justify-center shrink-0`}>
          <Icon d={icon} className="w-[18px] h-[18px]" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight leading-tight">{title}</h2>
          {desc && <p className="text-[11px] text-foreground/50 leading-tight">{desc}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function Field({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground/70 mb-1.5">
        {label}
        {optional && <span className="ml-1 font-medium text-foreground/35">(opsional)</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-foreground/45 leading-snug">{hint}</p>}
    </div>
  );
}
