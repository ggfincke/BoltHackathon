import { supabase } from '~/lib/supabaseClient';

export interface BestDeal {
  id: string;
  name: string; // product name
  slug?: string;
  bestPrice: number;
  worstPrice: number;
  bestRetailer: string;
  worstRetailer: string;
  savings: number; // percent savings
  imageUrl: string;
}

/**
 * Fetches best deals from Supabase using server-side functions and fallback logic.
 * No hard limit is applied when selecting fallback products; caller can slice results.
 */
export async function fetchBestDeals({
  priceGapPercent = 15,
  priceHistoryPercent = 10,
  resultLimit = 50,
}: {
  priceGapPercent?: number;
  priceHistoryPercent?: number;
  /** Maximum number of deals to return; pass a large number to get everything. */
  resultLimit?: number;
} = {}): Promise<BestDeal[]> {
  try {
    // ------------------------------------------------------------------
    // 1. Price gap & price history functions
    // ------------------------------------------------------------------
    const [gapRes, histRes] = await Promise.all([
      supabase.rpc('get_price_gap_deals', {
        min_percent_diff: priceGapPercent,
        limit_count: resultLimit,
      }),
      supabase.rpc('get_price_history_deals', {
        min_percent_change: priceHistoryPercent,
        limit_count: resultLimit,
      }),
    ]);

    const combined: BestDeal[] = [];

    if (gapRes.data) {
      combined.push(
        ...gapRes.data
          .filter((d) => d.worst_price && d.best_price && d.product_id)
          .map((d) => ({
            id: d.product_id,
            name: d.product_name,
            slug: d.product_slug,
            bestPrice: d.best_price,
            worstPrice: d.worst_price,
            bestRetailer: d.best_retailer_name,
            worstRetailer: d.worst_retailer_name ?? 'Other',
            savings: Math.round(((d.worst_price - d.best_price) / d.worst_price) * 100),
            imageUrl:
              d.image_url ||
              'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300',
          }))
          .filter((d) => d.savings > 0 && d.savings <= 100),
      );
    }

    if (histRes.data) {
      combined.push(
        ...histRes.data
          .filter((d) => d.old_price && d.current_price && d.product_id)
          .map((d) => ({
            id: d.product_id,
            name: d.product_name,
            slug: d.product_slug,
            bestPrice: d.current_price,
            worstPrice: d.old_price,
            bestRetailer: d.retailer_name,
            worstRetailer: `${d.retailer_name} (Prev)`,
            savings: Math.round(((d.old_price - d.current_price) / d.old_price) * 100),
            imageUrl:
              d.image_url ||
              'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300',
          }))
          .filter((d) => d.savings > 0 && d.savings <= 100),
      );
    }

    // ------------------------------------------------------------------
    // 2. Fallback products if not enough deals
    // ------------------------------------------------------------------
    if (combined.length < resultLimit) {
      const { data: products, error } = await supabase
        .from('products')
        .select(
          `id,name,slug,listings!inner(id,price,retailer:retailers!inner(name),image_url,in_stock)`
        ); // NO LIMIT applied here

      if (!error && products) {
        const moreDeals: BestDeal[] = products
          .filter((p) => p.listings && p.listings.length >= 2)
          .flatMap((p) => {
            const validListings = p.listings.filter(
              (l): l is typeof l & { price: number } =>
                l.price !== null && l.price > 0 && !!l.retailer?.name,
            );
            if (validListings.length < 2) return [];
            const sorted = [...validListings].sort((a, b) => (a.price || 999) - (b.price || 999));
            const best = sorted[0];
            const worst = sorted[sorted.length - 1];

            // At this point price is guaranteed to be number by our filter, but TS doesn't infer; cast.
            const bestPrice = best.price as number;
            const worstPrice = worst.price as number;

            const savings = Math.round(((worstPrice - bestPrice) / worstPrice) * 100);
            if (savings <= 0 || savings > 100) return [];
            return [
              {
                id: p.id,
                name: p.name,
                slug: p.slug,
                bestPrice: bestPrice,
                worstPrice: worstPrice,
                bestRetailer: best.retailer.name,
                worstRetailer: worst.retailer.name,
                savings,
                imageUrl:
                  best.image_url ||
                  'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300',
              },
            ];
          });

        combined.push(...moreDeals);
      }
    }

    // Deduplicate & sort
    const unique = combined.filter((d, idx, self) => idx === self.findIndex((o) => o.id === d.id));
    unique.sort((a, b) => b.savings - a.savings);

    return unique.slice(0, resultLimit);
  } catch (e) {
    console.error('fetchBestDeals error:', e);
    return [];
  }
} 