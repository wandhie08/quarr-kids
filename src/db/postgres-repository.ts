import pg from 'pg';
import type { Pool as PgPool } from 'pg';
const { Pool } = pg;
import type { Product, ProductVariant, Sale, SaleItem } from '../domain/types.js';
import type {
  NewProduct,
  NewVariant,
  RecordSaleInput,
  Repository,
  VariantSalesStat,
} from './repository.js';

/** Implementasi berbasis PostgreSQL. */
export class PostgresRepository implements Repository {
  private pool: PgPool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init(): Promise<void> {
    // Verifikasi koneksi lebih awal supaya error jelas.
    await this.pool.query('SELECT 1');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async addProduct(p: NewProduct): Promise<Product> {
    const { rows } = await this.pool.query(
      `INSERT INTO products (sku, name, category, base_price, production_cost)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, sku, name, category, base_price, production_cost, created_at`,
      [p.sku, p.name, p.category, p.basePrice, p.productionCost],
    );
    return this.mapProduct(rows[0]);
  }

  async addVariant(v: NewVariant): Promise<ProductVariant> {
    const { rows } = await this.pool.query(
      `INSERT INTO product_variants (product_id, size, color, stock)
       VALUES ($1, $2, $3, $4)
       RETURNING id, product_id, size, color, stock`,
      [v.productId, v.size, v.color, v.stock],
    );
    return this.mapVariant(rows[0]);
  }

  async listProducts(): Promise<Product[]> {
    const { rows } = await this.pool.query(
      `SELECT id, sku, name, category, base_price, production_cost, created_at
       FROM products ORDER BY id`,
    );
    return rows.map((r: Record<string, unknown>) => this.mapProduct(r));
  }

  async listVariants(productId?: number): Promise<ProductVariant[]> {
    const { rows } =
      productId === undefined
        ? await this.pool.query(
            `SELECT id, product_id, size, color, stock FROM product_variants ORDER BY id`,
          )
        : await this.pool.query(
            `SELECT id, product_id, size, color, stock FROM product_variants WHERE product_id = $1 ORDER BY id`,
            [productId],
          );
    return rows.map((r: Record<string, unknown>) => this.mapVariant(r));
  }

  async recordSale(input: RecordSaleInput): Promise<Sale> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const saleRes = await client.query(
        `INSERT INTO sales (channel, sold_at) VALUES ($1, COALESCE($2, now())) RETURNING id, channel, sold_at`,
        [input.channel, input.soldAt ?? null],
      );
      const saleId: number = saleRes.rows[0].id;
      const items: SaleItem[] = [];

      for (const item of input.items) {
        // Kunci baris varian & pastikan stok cukup.
        const variantRes = await client.query(
          `SELECT pv.id, pv.stock, p.base_price
           FROM product_variants pv
           JOIN products p ON p.id = pv.product_id
           WHERE pv.id = $1 FOR UPDATE`,
          [item.variantId],
        );
        if (variantRes.rowCount === 0) {
          throw new Error(`Variant tidak ditemukan: ${item.variantId}`);
        }
        const currentStock: number = variantRes.rows[0].stock;
        if (currentStock < item.quantity) {
          throw new Error(
            `Stok tidak cukup untuk variant ${item.variantId} (tersisa ${currentStock}, diminta ${item.quantity})`,
          );
        }
        const unitPrice =
          item.unitPrice ?? Number(variantRes.rows[0].base_price);

        await client.query(
          `UPDATE product_variants SET stock = stock - $1 WHERE id = $2`,
          [item.quantity, item.variantId],
        );

        const itemRes = await client.query(
          `INSERT INTO sale_items (sale_id, variant_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)
           RETURNING id, sale_id, variant_id, quantity, unit_price`,
          [saleId, item.variantId, item.quantity, unitPrice],
        );
        const r = itemRes.rows[0];
        items.push({
          id: r.id,
          saleId: r.sale_id,
          variantId: r.variant_id,
          quantity: r.quantity,
          unitPrice: Number(r.unit_price),
        });
      }

      await client.query('COMMIT');
      return {
        id: saleId,
        channel: saleRes.rows[0].channel,
        soldAt: saleRes.rows[0].sold_at,
        items,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async salesStatsSince(since: Date): Promise<VariantSalesStat[]> {
    const { rows } = await this.pool.query(
      `SELECT
         pv.id            AS variant_id,
         p.id             AS product_id,
         p.name           AS product_name,
         p.category       AS category,
         pv.size          AS size,
         pv.color         AS color,
         pv.stock         AS current_stock,
         COALESCE(SUM(si.quantity), 0)                    AS units_sold,
         COALESCE(SUM(si.quantity * si.unit_price), 0)    AS revenue
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN sale_items si ON si.variant_id = pv.id
       LEFT JOIN sales s ON s.id = si.sale_id AND s.sold_at >= $1
       GROUP BY pv.id, p.id, p.name, p.category, pv.size, pv.color, pv.stock
       ORDER BY units_sold DESC`,
      [since],
    );
    return rows.map((r: Record<string, unknown>) => this.mapStat(r));
  }

  async lowStockVariants(threshold: number): Promise<VariantSalesStat[]> {
    const all = await this.salesStatsSince(new Date(0));
    return all
      .filter((s) => s.currentStock <= threshold)
      .sort((a, b) => a.currentStock - b.currentStock);
  }

  private mapProduct(r: Record<string, unknown>): Product {
    return {
      id: r.id as number,
      sku: r.sku as string,
      name: r.name as string,
      category: r.category as string,
      basePrice: Number(r.base_price),
      productionCost: Number(r.production_cost),
      createdAt: r.created_at as Date,
    };
  }

  private mapVariant(r: Record<string, unknown>): ProductVariant {
    return {
      id: r.id as number,
      productId: r.product_id as number,
      size: r.size as string,
      color: r.color as string,
      stock: r.stock as number,
    };
  }

  private mapStat(r: Record<string, unknown>): VariantSalesStat {
    return {
      variantId: r.variant_id as number,
      productId: r.product_id as number,
      productName: r.product_name as string,
      category: r.category as string,
      size: r.size as string,
      color: r.color as string,
      currentStock: Number(r.current_stock),
      unitsSold: Number(r.units_sold),
      revenue: Number(r.revenue),
    };
  }
}
