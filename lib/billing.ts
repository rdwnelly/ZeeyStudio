/**
 * Perhitungan tagihan klien — satu sumber kebenaran untuk galeri (tampilan)
 * dan server (penentu nominal pembayaran & validasi pelunasan).
 *
 * Total = maks(0, harga paket + foto ekstra × harga foto tambahan + Σ layanan tambahan − DP)
 * Layanan dengan skema "sudah bayar" tidak ditagih.
 */
export type BillPriceItem = {
  id: string;
  name?: string;
  price: number;
  unit?: string;
  isSystem?: boolean;
  scheme?: "berbayar" | "sudah bayar";
};

export const DEFAULT_EXTRA_PHOTO_PRICE = 50000;

export const DEFAULT_SYSTEM_PRICES: BillPriceItem[] = [
  { id: "extra_photo", name: "Foto Tambahan", price: DEFAULT_EXTRA_PHOTO_PRICE, unit: "per foto", isSystem: true },
  { id: "editor_request", name: "Jasa Editor (Retouch)", price: 100000, unit: "per request", isSystem: true },
];

/** Gabungkan daftar harga dari DB dengan item sistem bawaan (bila belum ada). */
export function withDefaultPrices(items: BillPriceItem[]): BillPriceItem[] {
  const map = new Map<string, BillPriceItem>();
  items.forEach((i) => {
    if (!map.has(i.id)) map.set(i.id, i);
  });
  DEFAULT_SYSTEM_PRICES.forEach((d) => {
    if (!map.has(d.id)) map.set(d.id, d);
  });
  const list = Array.from(map.values());
  list.sort((a, b) => (a.isSystem === b.isSystem ? 0 : a.isSystem ? -1 : 1));
  return list;
}

export type BillInput = {
  packagePrice?: number;
  dpAmount?: number;
  maxPhotos: number; // kuota aktif (proyek atau sub-token)
  selectedCount: number;
  addons: Record<string, number>;
  priceList: BillPriceItem[];
};

export type Bill = {
  extraPhotosCount: number;
  extraPhotoPrice: number;
  extraPhotosCost: number;
  addonsCost: number;
  totalExtraCost: number;
  grandTotal: number;
};

export function calculateBill(input: BillInput): Bill {
  const extraItem = input.priceList.find((p) => p.id === "extra_photo");
  const extraPhotoPrice = extraItem ? Number(extraItem.price) || 0 : DEFAULT_EXTRA_PHOTO_PRICE;
  const extraPhotosCount = Math.max(0, input.selectedCount - (Number(input.maxPhotos) || 0));
  const extraPhotosCost = extraPhotosCount * extraPhotoPrice;

  const addonsCost = Object.entries(input.addons || {}).reduce((acc, [id, qty]) => {
    const item = input.priceList.find((p) => p.id === id);
    const q = Math.max(0, Math.floor(Number(qty) || 0));
    if (item && item.scheme !== "sudah bayar") return acc + (Number(item.price) || 0) * q;
    return acc;
  }, 0);

  const totalExtraCost = extraPhotosCost + addonsCost;
  const grandTotal = Math.max(0, (Number(input.packagePrice) || 0) + totalExtraCost - (Number(input.dpAmount) || 0));
  return { extraPhotosCount, extraPhotoPrice, extraPhotosCost, addonsCost, totalExtraCost, grandTotal };
}
