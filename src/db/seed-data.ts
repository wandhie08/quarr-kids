import type { Repository } from '../db/repository.js';

/**
 * Isi data contoh yang realistis untuk demo:
 * beberapa produk baju anak 3-6 tahun + riwayat penjualan.
 * Dipakai oleh CLI demo dan bisa dijalankan terpisah (npm run db:seed).
 */
export async function seed(repo: Repository, now: Date = new Date()): Promise<void> {
  const daysAgo = (d: number) =>
    new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  // --- Produk ---
  const kaosDino = await repo.addProduct({
    sku: 'KAOS-DINO',
    name: 'Kaos Motif Dinosaurus',
    category: 'kaos',
    basePrice: 55000,
    productionCost: 28000,
  });
  const setelan = await repo.addProduct({
    sku: 'SET-FORMAL',
    name: 'Setelan Semi-Formal',
    category: 'setelan',
    basePrice: 145000,
    productionCost: 80000,
  });
  const dress = await repo.addProduct({
    sku: 'DRESS-FLORAL',
    name: 'Dress Floral',
    category: 'dress',
    basePrice: 120000,
    productionCost: 65000,
  });
  const jaket = await repo.addProduct({
    sku: 'JKT-HOODIE',
    name: 'Jaket Hoodie',
    category: 'jaket',
    basePrice: 130000,
    productionCost: 72000,
  });

  // --- Varian (size = umur 3-6) ---
  // Kaos Dino size 4: total terjual 24 pcs, mulai 32 → sisa 8 (laris & stok tipis).
  const vDino4 = await repo.addVariant({ productId: kaosDino.id, size: '4', color: 'hijau', stock: 32 });
  const vDino5 = await repo.addVariant({ productId: kaosDino.id, size: '5', color: 'hijau', stock: 40 });
  const vSet4 = await repo.addVariant({ productId: setelan.id, size: '4', color: 'navy', stock: 25 });
  const vDress5 = await repo.addVariant({ productId: dress.id, size: '5', color: 'pink', stock: 30 });
  // Jaket sengaja tanpa penjualan → jadi contoh slow mover di advisor.
  await repo.addVariant({ productId: jaket.id, size: '4', color: 'abu', stock: 50 });

  // --- Penjualan 30 hari terakhir ---
  // Kaos Dino size 4: laris & stok tipis (kandidat restock mendesak)
  await repo.recordSale({ channel: 'tiktok', soldAt: daysAgo(2), items: [{ variantId: vDino4.id, quantity: 6 }] });
  await repo.recordSale({ channel: 'tiktok', soldAt: daysAgo(8), items: [{ variantId: vDino4.id, quantity: 5 }] });
  await repo.recordSale({ channel: 'shopee', soldAt: daysAgo(15), items: [{ variantId: vDino4.id, quantity: 7 }] });
  await repo.recordSale({ channel: 'shopee', soldAt: daysAgo(22), items: [{ variantId: vDino4.id, quantity: 6 }] });

  // Kaos Dino size 5: laku sedang, stok banyak
  await repo.recordSale({ channel: 'tiktok', soldAt: daysAgo(5), items: [{ variantId: vDino5.id, quantity: 4 }] });
  await repo.recordSale({ channel: 'offline', soldAt: daysAgo(18), items: [{ variantId: vDino5.id, quantity: 3 }] });

  // Setelan: laku sedang (musiman tergantung bulan)
  await repo.recordSale({ channel: 'shopee', soldAt: daysAgo(3), items: [{ variantId: vSet4.id, quantity: 5 }] });
  await repo.recordSale({ channel: 'tiktok', soldAt: daysAgo(20), items: [{ variantId: vSet4.id, quantity: 4 }] });

  // Dress: laris
  await repo.recordSale({ channel: 'tiktok', soldAt: daysAgo(1), items: [{ variantId: vDress5.id, quantity: 8 }] });
  await repo.recordSale({ channel: 'tiktok', soldAt: daysAgo(10), items: [{ variantId: vDress5.id, quantity: 6 }] });

  // Jaket: nyaris tidak laku, stok menumpuk (slow mover)
  // (tidak ada penjualan)
}
