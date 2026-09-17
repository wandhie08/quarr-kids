/**
 * Tipe domain inti untuk platform bisnis baju anak.
 * Segmen: anak kecil (3-6 tahun). Ukuran memakai nomor (2,3,4,5,6) sesuai umur.
 */

export type Season =
  | 'lebaran'
  | 'tahun_ajaran_baru'
  | 'natal_tahun_baru'
  | 'musim_hujan'
  | 'reguler';

/** Produk induk, mis. "Kaos Motif Dinosaurus" */
export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string; // mis. kaos, setelan, dress, jaket
  basePrice: number; // harga jual (Rupiah)
  productionCost: number; // HPP per pcs (Rupiah)
  createdAt: Date;
}

/** Varian konkret dari produk: kombinasi ukuran + warna, punya stok sendiri */
export interface ProductVariant {
  id: number;
  productId: number;
  size: string; // "2".."6" (umur)
  color: string;
  stock: number;
}

/** Satu transaksi penjualan (bisa berisi beberapa item) */
export interface Sale {
  id: number;
  channel: string; // tiktok, shopee, offline, dll
  soldAt: Date;
  items: SaleItem[];
}

export interface SaleItem {
  id: number;
  saleId: number;
  variantId: number;
  quantity: number;
  unitPrice: number; // harga jual saat transaksi
}

/** Baris kalender musiman untuk Production Advisor */
export interface SeasonalWindow {
  season: Season;
  /** bulan (1-12) yang termasuk jendela persiapan produksi */
  months: number[];
  /** kategori produk yang biasanya naik pada musim ini */
  boostedCategories: string[];
  note: string;
}
