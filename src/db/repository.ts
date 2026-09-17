import type {
  Product,
  ProductVariant,
  Sale,
} from '../domain/types.js';

export interface NewProduct {
  sku: string;
  name: string;
  category: string;
  basePrice: number;
  productionCost: number;
}

export interface NewVariant {
  productId: number;
  size: string;
  color: string;
  stock: number;
}

export interface RecordSaleItem {
  variantId: number;
  quantity: number;
  unitPrice?: number; // default: basePrice produk
}

export interface RecordSaleInput {
  channel: string;
  soldAt?: Date;
  items: RecordSaleItem[];
}

/** Baris agregat penjualan per varian dalam rentang waktu tertentu. */
export interface VariantSalesStat {
  variantId: number;
  productId: number;
  productName: string;
  category: string;
  size: string;
  color: string;
  currentStock: number;
  unitsSold: number;
  revenue: number;
}

/**
 * Kontrak penyimpanan data. Dua implementasi:
 * - PostgresRepository (produksi)
 * - InMemoryRepository (demo tanpa DB)
 */
export interface Repository {
  init(): Promise<void>;
  close(): Promise<void>;

  addProduct(p: NewProduct): Promise<Product>;
  addVariant(v: NewVariant): Promise<ProductVariant>;
  listProducts(): Promise<Product[]>;
  listVariants(productId?: number): Promise<ProductVariant[]>;

  recordSale(input: RecordSaleInput): Promise<Sale>;

  /** Statistik penjualan per varian sejak tanggal `since`. */
  salesStatsSince(since: Date): Promise<VariantSalesStat[]>;

  /** Varian dengan stok di bawah/di ambang `threshold`. */
  lowStockVariants(threshold: number): Promise<VariantSalesStat[]>;
}
