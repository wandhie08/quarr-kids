# Kids Brand AI

Platform AI agent untuk bisnis baju anak (segmen 3-6 tahun, brand sendiri).
Fondasi ini berisi **2 modul inti** ("otak bisnis"):

1. **Sales & Stock Tracker** — catat penjualan, rekap omzet, produk terlaris, peringatan stok menipis + estimasi kapan habis.
2. **Production Advisor** — rekomendasi "produksi apa & berapa" tiap minggu/bulan, berbasis kecepatan penjualan (velocity) + kalender musiman Indonesia (Lebaran, tahun ajaran baru, musim hujan, Natal).

Modul berikutnya (belum dibangun): Content Generator, CS WhatsApp Bot, Photo Enhancer.

## Arsitektur

```
src/
  config.ts                 # baca .env
  domain/
    types.ts                # tipe inti (Product, Variant, Sale, dst.)
    seasonal.ts             # kalender musiman Indonesia
  db/
    schema.sql              # skema PostgreSQL
    repository.ts           # kontrak penyimpanan (interface)
    in-memory-repository.ts # implementasi in-memory (demo/test)
    postgres-repository.ts  # implementasi PostgreSQL (produksi)
    factory.ts              # pilih impl berdasarkan .env
    migrate.ts / seed.ts    # migrasi & seed data
  modules/
    sales-tracker.ts        # modul 1
    production-advisor.ts   # modul 2
  cli/index.ts              # entry point + demo
```

Desain memakai **repository pattern**: logika bisnis tidak tahu apakah datanya di PostgreSQL atau in-memory. Ini membuat demo bisa jalan tanpa setup database, dan mudah diuji.

## Cara Menjalankan

Install:

```bash
npm install
```

Demo cepat (tanpa perlu PostgreSQL — pakai data contoh in-memory):

```bash
npm run demo
```

### Pakai PostgreSQL

1. Salin `.env.example` menjadi `.env`, isi `DATABASE_URL`, set `USE_IN_MEMORY=false`.
2. Migrasi & seed:

```bash
npm run db:migrate
npm run db:seed
npm run dev status   # cek koneksi
```

## Cara Kerja Production Advisor

Untuk tiap varian produk:

- `dailyVelocity = unitsSold / analysisDays` (default periode analisis 30 hari)
- `projectedDemand = dailyVelocity * planningHorizon` (× 1.5 bila kategori sedang musim naik)
- `suggestedQuantity = ceil(projectedDemand * safetyFactor - currentStock)`, minimal 0

Alasan rekomendasi: `high_velocity_low_stock` (restock mendesak), `high_velocity`, `seasonal_boost`, `slow_mover` (tunda produksi).

Parameter (`analysisDays`, `planningHorizonDays`, `lowStockThreshold`, `safetyFactor`) bisa di-override lewat argumen `recommend()`.

**Batasan fase awal:** rekomendasi murni berbasis data penjualan internal + kalender musiman (andal & etis). Sinyal eksternal (Google Trends, best-seller marketplace) bisa ditambahkan di fase lanjut sebagai sumber sinyal tambahan.
