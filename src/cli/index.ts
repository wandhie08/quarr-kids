import { InMemoryRepository } from '../db/in-memory-repository.js';
import { createRepository } from '../db/factory.js';
import { seed } from '../db/seed-data.js';
import type { Repository } from '../db/repository.js';
import { SalesTracker } from '../modules/sales-tracker.js';
import { ProductionAdvisor } from '../modules/production-advisor.js';

const rupiah = (n: number) =>
  'Rp' + n.toLocaleString('id-ID', { maximumFractionDigits: 0 });

function line(char = '─', len = 60): string {
  return char.repeat(len);
}

async function runDemo(): Promise<void> {
  // Demo selalu memakai in-memory + seed, agar bisa jalan tanpa PostgreSQL.
  const repo: Repository = new InMemoryRepository();
  await repo.init();
  await seed(repo);

  const tracker = new SalesTracker(repo);
  const advisor = new ProductionAdvisor(repo);

  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  console.log('\n' + line('='));
  console.log('  KIDS BRAND AI — DEMO (data contoh, in-memory)');
  console.log(line('='));

  // === MODUL: SALES & STOCK TRACKER ===
  console.log('\n[1] SALES & STOCK TRACKER');
  console.log(line());

  const summary = await tracker.summarySince(since30);
  console.log(`Ringkasan 30 hari terakhir:`);
  console.log(`  Total unit terjual : ${summary.totalUnits} pcs`);
  console.log(`  Total omzet        : ${rupiah(summary.totalRevenue)}`);

  console.log('\nProduk terlaris:');
  const top = await tracker.topSellers(since30, 5);
  top.forEach((s, i) => {
    console.log(
      `  ${i + 1}. ${s.productName} [size ${s.size}/${s.color}] — ${s.unitsSold} pcs, ${rupiah(s.revenue)}`,
    );
  });

  console.log('\nPeringatan stok menipis (ambang <= 15 pcs):');
  const alerts = await tracker.lowStockAlerts(15, 30, now);
  if (alerts.length === 0) {
    console.log('  (tidak ada)');
  } else {
    alerts.forEach((a) => {
      const eta =
        a.daysUntilStockout === null
          ? 'tidak bergerak'
          : `~${a.daysUntilStockout.toFixed(1)} hari lagi habis`;
      console.log(
        `  • ${a.productName} [size ${a.size}/${a.color}] — sisa ${a.currentStock} pcs, ${eta}`,
      );
    });
  }

  // === MODUL: PRODUCTION ADVISOR ===
  console.log('\n\n[2] PRODUCTION ADVISOR');
  console.log(line());

  const plan = await advisor.recommend('minggu', { now });
  console.log(plan.headline);
  if (plan.activeSeasons.length > 0) {
    console.log('\nCatatan musiman:');
    plan.activeSeasons.forEach((s) => console.log(`  • ${s.note}`));
  }

  console.log('\nRekomendasi produksi:');
  plan.recommendations.forEach((r) => {
    const tag = r.suggestedQuantity > 0 ? `PRODUKSI ${r.suggestedQuantity} pcs` : 'tunda';
    console.log(
      `  • ${r.productName} [size ${r.size}/${r.color}] → ${tag}`,
    );
    console.log(
      `      velocity ${r.dailyVelocity}/hari, stok ${r.currentStock}, alasan: ${r.reasons.join(', ') || '-'}`,
    );
    console.log(`      ${r.note}`);
  });

  console.log('\n' + line('='));
  console.log('  Selesai. Ganti USE_IN_MEMORY=false + set DATABASE_URL untuk pakai PostgreSQL.');
  console.log(line('=') + '\n');

  await repo.close();
}

async function showStatus(): Promise<void> {
  // Perlihatkan repository mana yang aktif berdasarkan config nyata.
  const repo = await createRepository();
  const products = await repo.listProducts();
  console.log(`Repository aktif. Jumlah produk tersimpan: ${products.length}`);
  await repo.close();
}

/**
 * Ekspor data produk + penjualan sebagai JSON ke stdout.
 * Dipakai oleh Kiro skill "content-generator" sebagai sumber data.
 * Default memakai data contoh in-memory (zero setup); pakai --db untuk PostgreSQL.
 */
async function exportData(useDb: boolean): Promise<void> {
  let repo: Repository;
  if (useDb) {
    repo = await createRepository();
  } else {
    repo = new InMemoryRepository();
    await repo.init();
    await seed(repo);
  }

  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const products = await repo.listProducts();
  const variants = await repo.listVariants();
  const stats = await repo.salesStatsSince(since30);

  const payload = {
    generatedAt: now.toISOString(),
    brand: { style: 'santai/daily', segment: 'anak 3-6 tahun' },
    products,
    variants,
    salesLast30Days: stats,
  };

  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  await repo.close();
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'demo';

  switch (command) {
    case 'demo':
      await runDemo();
      break;
    case 'status':
      await showStatus();
      break;
    case 'export':
      await exportData(process.argv.includes('--db'));
      break;
    default:
      console.log('Perintah tersedia:');
      console.log('  demo          Jalankan demo kedua modul dengan data contoh (in-memory)');
      console.log('  status        Cek koneksi repository aktif (mengikuti .env)');
      console.log('  export        Ekspor data produk + penjualan sebagai JSON (in-memory contoh)');
      console.log('  export --db   Ekspor data dari PostgreSQL (sesuai .env)');
      break;
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
