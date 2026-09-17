import type { Repository, RecordSaleInput, VariantSalesStat } from '../db/repository.js';
import type { Sale } from '../domain/types.js';

export interface SalesSummary {
  since: Date;
  totalUnits: number;
  totalRevenue: number;
  totalTransactions: number;
}

export interface StockAlert {
  variantId: number;
  productName: string;
  size: string;
  color: string;
  currentStock: number;
  unitsSold: number; // dalam periode analisis
  /** rata-rata terjual per hari dalam periode → dipakai untuk estimasi habis */
  dailyVelocity: number;
  /** perkiraan hari sampai stok habis (null jika velocity 0) */
  daysUntilStockout: number | null;
}

/**
 * Modul Sales & Stock Tracker.
 * Bertanggung jawab mencatat penjualan dan meringkas kinerja + kondisi stok.
 * Sumber data utama untuk Production Advisor.
 */
export class SalesTracker {
  constructor(private readonly repo: Repository) {}

  /** Catat satu transaksi penjualan (otomatis mengurangi stok). */
  async recordSale(input: RecordSaleInput): Promise<Sale> {
    if (input.items.length === 0) {
      throw new Error('Transaksi penjualan harus punya minimal 1 item.');
    }
    return this.repo.recordSale(input);
  }

  /** Ringkasan penjualan sejak tanggal tertentu. */
  async summarySince(since: Date): Promise<SalesSummary> {
    const stats = await this.repo.salesStatsSince(since);
    const totalUnits = stats.reduce((acc, s) => acc + s.unitsSold, 0);
    const totalRevenue = stats.reduce((acc, s) => acc + s.revenue, 0);
    return {
      since,
      totalUnits,
      totalRevenue,
      totalTransactions: 0, // diisi dari caller bila perlu; ringkasan fokus unit & revenue
    };
  }

  /** Produk/varian terlaris sejak tanggal tertentu (urut unitsSold desc). */
  async topSellers(since: Date, limit = 5): Promise<VariantSalesStat[]> {
    const stats = await this.repo.salesStatsSince(since);
    return stats
      .filter((s) => s.unitsSold > 0)
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, limit);
  }

  /**
   * Peringatan stok menipis. Menggabungkan stok saat ini dengan kecepatan
   * penjualan (velocity) dalam `periodDays` terakhir untuk estimasi kapan habis.
   */
  async lowStockAlerts(
    threshold: number,
    periodDays = 30,
    now: Date = new Date(),
  ): Promise<StockAlert[]> {
    const since = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const stats = await this.repo.salesStatsSince(since);

    return stats
      .filter((s) => s.currentStock <= threshold)
      .map((s) => {
        const dailyVelocity = s.unitsSold / periodDays;
        const daysUntilStockout =
          dailyVelocity > 0 ? s.currentStock / dailyVelocity : null;
        return {
          variantId: s.variantId,
          productName: s.productName,
          size: s.size,
          color: s.color,
          currentStock: s.currentStock,
          unitsSold: s.unitsSold,
          dailyVelocity,
          daysUntilStockout,
        };
      })
      .sort((a, b) => {
        // yang paling mendesak (paling cepat habis) di atas
        const av = a.daysUntilStockout ?? Infinity;
        const bv = b.daysUntilStockout ?? Infinity;
        return av - bv;
      });
  }
}
