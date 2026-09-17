import type { Repository, VariantSalesStat } from '../db/repository.js';
import { seasonsForMonth } from '../domain/seasonal.js';
import type { SeasonalWindow } from '../domain/types.js';

export type RecommendationReason =
  | 'high_velocity_low_stock' // laris + stok menipis → restock mendesak
  | 'high_velocity' // laris → pertahankan/naikkan produksi
  | 'seasonal_boost' // kategori naik karena musim
  | 'slow_mover'; // lambat → kurangi/hentikan produksi

export interface ProductionRecommendation {
  variantId: number;
  productName: string;
  category: string;
  size: string;
  color: string;
  currentStock: number;
  unitsSold: number;
  dailyVelocity: number;
  /** saran jumlah produksi untuk periode ke depan (pcs). 0 = jangan produksi dulu */
  suggestedQuantity: number;
  reasons: RecommendationReason[];
  note: string;
}

export interface ProductionPlan {
  generatedAt: Date;
  periodLabel: string; // "minggu" | "bulan"
  activeSeasons: SeasonalWindow[];
  recommendations: ProductionRecommendation[];
  headline: string;
}

export interface AdvisorOptions {
  /** panjang periode analisis penjualan (hari), default 30 */
  analysisDays?: number;
  /** horizon perencanaan produksi ke depan (hari), default 30 */
  planningHorizonDays?: number;
  /** ambang stok dianggap "menipis" */
  lowStockThreshold?: number;
  /** buffer stok pengaman sebagai kelipatan kebutuhan horizon, default 1.5 */
  safetyFactor?: number;
  now?: Date;
}

/**
 * Production Advisor.
 * Menggabungkan sinyal internal (velocity penjualan + kondisi stok) dengan
 * kalender musiman Indonesia untuk merekomendasikan "produksi apa" dan "berapa".
 *
 * Batasan: fase awal murni berbasis data internal + kalender musiman (andal & etis).
 * Sinyal eksternal (Google Trends, marketplace) bisa ditambahkan di fase lanjut.
 */
export class ProductionAdvisor {
  constructor(private readonly repo: Repository) {}

  async recommend(
    periodLabel: 'minggu' | 'bulan' = 'minggu',
    options: AdvisorOptions = {},
  ): Promise<ProductionPlan> {
    const now = options.now ?? new Date();
    const analysisDays = options.analysisDays ?? 30;
    const horizon = options.planningHorizonDays ?? 30;
    const lowStockThreshold = options.lowStockThreshold ?? 15;
    const safetyFactor = options.safetyFactor ?? 1.5;

    const since = new Date(now.getTime() - analysisDays * 24 * 60 * 60 * 1000);
    const stats = await this.repo.salesStatsSince(since);
    const activeSeasons = seasonsForMonth(now.getMonth() + 1);
    const boostedCategories = new Set(
      activeSeasons.flatMap((s) => s.boostedCategories),
    );

    const recommendations = stats
      .map((s) =>
        this.evaluate(s, {
          analysisDays,
          horizon,
          lowStockThreshold,
          safetyFactor,
          boostedCategories,
        }),
      )
      // Tampilkan yang perlu aksi lebih dulu (kuantitas saran tertinggi di atas).
      .sort((a, b) => b.suggestedQuantity - a.suggestedQuantity);

    const headline = this.buildHeadline(
      periodLabel,
      activeSeasons,
      recommendations,
    );

    return {
      generatedAt: now,
      periodLabel,
      activeSeasons,
      recommendations,
      headline,
    };
  }

  private evaluate(
    s: VariantSalesStat,
    ctx: {
      analysisDays: number;
      horizon: number;
      lowStockThreshold: number;
      safetyFactor: number;
      boostedCategories: Set<string>;
    },
  ): ProductionRecommendation {
    const dailyVelocity = s.unitsSold / ctx.analysisDays;
    const reasons: RecommendationReason[] = [];

    // Proyeksi permintaan sepanjang horizon perencanaan.
    let projectedDemand = dailyVelocity * ctx.horizon;

    const isSeasonal = ctx.boostedCategories.has(s.category);
    if (isSeasonal) {
      // Antisipasi lonjakan musiman: naikkan proyeksi 50%.
      projectedDemand *= 1.5;
      reasons.push('seasonal_boost');
    }

    const isFast = dailyVelocity > 0 && s.unitsSold >= ctx.analysisDays / 6; // ~laku >=5x/30hr
    const isLowStock = s.currentStock <= ctx.lowStockThreshold;

    // Kebutuhan produksi = (permintaan proyeksi * safety) - stok saat ini.
    let suggested = Math.ceil(
      projectedDemand * ctx.safetyFactor - s.currentStock,
    );
    if (suggested < 0) suggested = 0;

    if (isFast && isLowStock) {
      reasons.push('high_velocity_low_stock');
    } else if (isFast) {
      reasons.push('high_velocity');
    }

    // Slow mover: hampir tidak laku & masih ada stok → jangan produksi.
    if (dailyVelocity === 0 && s.currentStock > 0) {
      reasons.push('slow_mover');
      suggested = 0;
    }

    return {
      variantId: s.variantId,
      productName: s.productName,
      category: s.category,
      size: s.size,
      color: s.color,
      currentStock: s.currentStock,
      unitsSold: s.unitsSold,
      dailyVelocity: Number(dailyVelocity.toFixed(3)),
      suggestedQuantity: suggested,
      reasons,
      note: this.buildNote(s, reasons, suggested),
    };
  }

  private buildNote(
    s: VariantSalesStat,
    reasons: RecommendationReason[],
    suggested: number,
  ): string {
    if (reasons.includes('slow_mover')) {
      return `Lambat terjual (${s.unitsSold} pcs). Habiskan stok dulu (${s.currentStock} pcs), tunda produksi.`;
    }
    if (reasons.includes('high_velocity_low_stock')) {
      return `Laris & stok menipis (sisa ${s.currentStock}). Restock mendesak ~${suggested} pcs.`;
    }
    if (reasons.includes('seasonal_boost') && suggested > 0) {
      return `Masuk musim naik untuk kategori "${s.category}". Siapkan ~${suggested} pcs.`;
    }
    if (reasons.includes('high_velocity')) {
      return `Penjualan sehat (${s.unitsSold} pcs). Pertahankan produksi ~${suggested} pcs.`;
    }
    if (suggested > 0) {
      return `Produksi ~${suggested} pcs untuk memenuhi proyeksi permintaan.`;
    }
    return 'Stok cukup untuk periode ini. Belum perlu produksi.';
  }

  private buildHeadline(
    periodLabel: string,
    activeSeasons: SeasonalWindow[],
    recs: ProductionRecommendation[],
  ): string {
    const toProduce = recs.filter((r) => r.suggestedQuantity > 0);
    const totalPcs = toProduce.reduce((a, r) => a + r.suggestedQuantity, 0);
    const seasonNote =
      activeSeasons.length > 0
        ? ` Musim aktif: ${activeSeasons.map((s) => s.season).join(', ')}.`
        : '';

    if (toProduce.length === 0) {
      return `Rekomendasi ${periodLabel} ini: belum ada produksi mendesak.${seasonNote}`;
    }
    return `Rekomendasi ${periodLabel} ini: produksi ${toProduce.length} varian (~${totalPcs} pcs total).${seasonNote}`;
  }
}
