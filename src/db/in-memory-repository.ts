import type {
  Product,
  ProductVariant,
  Sale,
  SaleItem,
} from '../domain/types.js';
import type {
  NewProduct,
  NewVariant,
  RecordSaleInput,
  Repository,
  VariantSalesStat,
} from './repository.js';

/** Implementasi in-memory. Data hilang saat proses berhenti — untuk demo & test. */
export class InMemoryRepository implements Repository {
  private products: Product[] = [];
  private variants: ProductVariant[] = [];
  private sales: Sale[] = [];
  private saleItems: SaleItem[] = [];
  private seq = { product: 0, variant: 0, sale: 0, saleItem: 0 };

  async init(): Promise<void> {
    /* no-op */
  }
  async close(): Promise<void> {
    /* no-op */
  }

  async addProduct(p: NewProduct): Promise<Product> {
    if (this.products.some((x) => x.sku === p.sku)) {
      throw new Error(`SKU sudah ada: ${p.sku}`);
    }
    const product: Product = {
      id: ++this.seq.product,
      sku: p.sku,
      name: p.name,
      category: p.category,
      basePrice: p.basePrice,
      productionCost: p.productionCost,
      createdAt: new Date(),
    };
    this.products.push(product);
    return product;
  }

  async addVariant(v: NewVariant): Promise<ProductVariant> {
    if (!this.products.some((p) => p.id === v.productId)) {
      throw new Error(`Product tidak ditemukan: ${v.productId}`);
    }
    const variant: ProductVariant = {
      id: ++this.seq.variant,
      productId: v.productId,
      size: v.size,
      color: v.color,
      stock: v.stock,
    };
    this.variants.push(variant);
    return variant;
  }

  async listProducts(): Promise<Product[]> {
    return [...this.products];
  }

  async listVariants(productId?: number): Promise<ProductVariant[]> {
    return this.variants.filter(
      (v) => productId === undefined || v.productId === productId,
    );
  }

  async recordSale(input: RecordSaleInput): Promise<Sale> {
    const sale: Sale = {
      id: ++this.seq.sale,
      channel: input.channel,
      soldAt: input.soldAt ?? new Date(),
      items: [],
    };

    for (const item of input.items) {
      const variant = this.variants.find((v) => v.id === item.variantId);
      if (!variant) throw new Error(`Variant tidak ditemukan: ${item.variantId}`);
      if (variant.stock < item.quantity) {
        throw new Error(
          `Stok tidak cukup untuk variant ${item.variantId} (tersisa ${variant.stock}, diminta ${item.quantity})`,
        );
      }
      const product = this.products.find((p) => p.id === variant.productId)!;
      const unitPrice = item.unitPrice ?? product.basePrice;

      variant.stock -= item.quantity; // kurangi stok

      const saleItem: SaleItem = {
        id: ++this.seq.saleItem,
        saleId: sale.id,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice,
      };
      this.saleItems.push(saleItem);
      sale.items.push(saleItem);
    }

    this.sales.push(sale);
    return sale;
  }

  async salesStatsSince(since: Date): Promise<VariantSalesStat[]> {
    const saleIdsInRange = new Set(
      this.sales.filter((s) => s.soldAt >= since).map((s) => s.id),
    );

    const statByVariant = new Map<number, VariantSalesStat>();

    for (const variant of this.variants) {
      const product = this.products.find((p) => p.id === variant.productId)!;
      statByVariant.set(variant.id, {
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        category: product.category,
        size: variant.size,
        color: variant.color,
        currentStock: variant.stock,
        unitsSold: 0,
        revenue: 0,
      });
    }

    for (const item of this.saleItems) {
      if (!saleIdsInRange.has(item.saleId)) continue;
      const stat = statByVariant.get(item.variantId);
      if (!stat) continue;
      stat.unitsSold += item.quantity;
      stat.revenue += item.quantity * item.unitPrice;
    }

    return [...statByVariant.values()];
  }

  async lowStockVariants(threshold: number): Promise<VariantSalesStat[]> {
    const all = await this.salesStatsSince(new Date(0));
    return all
      .filter((s) => s.currentStock <= threshold)
      .sort((a, b) => a.currentStock - b.currentStock);
  }
}
