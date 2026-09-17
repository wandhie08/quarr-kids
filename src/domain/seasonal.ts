import type { SeasonalWindow } from '../domain/types.js';

/**
 * Kalender musiman belanja baju anak di Indonesia.
 * "months" = bulan di mana produksi sebaiknya SUDAH disiapkan (lead time diperhitungkan),
 * bukan bulan puncak penjualannya.
 *
 * Catatan: tanggal Lebaran bergeser tiap tahun (kalender Hijriah). Nilai bulan di sini
 * adalah perkiraan kasar untuk sekitar 2026 dan sebaiknya ditinjau tiap tahun.
 */
export const SEASONAL_CALENDAR: SeasonalWindow[] = [
  {
    season: 'lebaran',
    months: [1, 2, 3], // siapkan produksi ~1-3 bulan sebelum Idul Fitri
    boostedCategories: ['setelan', 'gamis', 'koko', 'dress'],
    note: 'Persiapan Lebaran: baju muslim & setelan formal anak paling laku. Puncak permintaan tertinggi tahunan.',
  },
  {
    season: 'tahun_ajaran_baru',
    months: [5, 6], // siapkan sebelum masuk sekolah (Juli)
    boostedCategories: ['setelan', 'kaos', 'celana'],
    note: 'Tahun ajaran baru: baju semi-formal & daily wear untuk sekolah/PAUD/TK naik.',
  },
  {
    season: 'musim_hujan',
    months: [9, 10], // siapkan sebelum puncak hujan (Nov-Feb)
    boostedCategories: ['jaket', 'sweater', 'setelan_lengan_panjang'],
    note: 'Musim hujan: outerwear anak (jaket, sweater) naik.',
  },
  {
    season: 'natal_tahun_baru',
    months: [10, 11], // siapkan sebelum Des
    boostedCategories: ['dress', 'setelan', 'kaos'],
    note: 'Natal & liburan akhir tahun: baju pesta/liburan anak naik, terutama di segmen tertentu.',
  },
];

/** Cari musim yang jendela produksinya mencakup bulan tertentu (1-12). */
export function seasonsForMonth(month: number): SeasonalWindow[] {
  return SEASONAL_CALENDAR.filter((w) => w.months.includes(month));
}
