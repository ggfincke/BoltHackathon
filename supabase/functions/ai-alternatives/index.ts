import { createClient } from 'npm:@supabase/supabase-js@2.42.0';
import OpenAI from 'npm:openai@4.28.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

interface ProductAlternative {
  product_id: string;
  product_name: string;
  brand?: string;
  price?: number;
  retailer?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  image_url?: string;
  similarity_score: number;
}

interface AlternativesResponse {
  alternatives: ProductAlternative[];
  original_product: {
    id: string;
    name: string;
    brand?: string;
  };
}

// Database helper functions for alternatives
class AlternativesHelpers {
  private categoryStrictnessMap: Map<string, number> = new Map();

  constructor(private supabase: any) {
    this.initializeCategoryStrictness();
  }

  private initializeCategoryStrictness() {
    // Create a mapping of category names to strictness scores (0.0 = loose, 1.0 = strict)
    // This is based on analysis of the category structure from categories.json
    
    const categoryMappings = {
      // Very strict categories - specific product types with many similar alternatives
      'yogurt': 0.9,
      'milk': 0.9,
      'cheese': 0.9,
      'eggs': 0.9,
      'cereal': 0.9,
      'bread': 0.9, 
      'breads': 0.9,
      'cookies': 0.9,
      'chips': 0.9,
      'crackers': 0.9,
      'coffee': 0.9,
      'soda & pop': 0.9,
      'juice & cider': 0.9,
      'water': 0.9,
      'frozen pizza': 0.9,
      'frozen meals': 0.9,
      'ice cream & novelties': 0.9,
      'chocolate candy': 0.9,
      'nuts': 0.8,
      'butter & margarine': 0.8,
      'bagels & muffins': 0.8,
      'oatmeal': 0.8,
      'pancake mix & syrup': 0.8,
      'energy drinks': 0.8,
      'baby formula': 0.8,
      
      // Moderately strict categories
      'canned foods': 0.7,
      'condiments & sauces': 0.7,
      'peanut butter & jelly': 0.7,
      'cooking oil & vinegar': 0.7,
      'baking staples': 0.7,
      'pasta, rice & grains': 0.6,
      'gummy & chewy candy': 0.6,
      'hard candy': 0.6,
      'baby food jars & pouches': 0.6,
      'frozen vegetables': 0.6,
      
      // Moderately loose categories
      'chicken': 0.4,
      'beef': 0.4,
      'bacon': 0.4,
      'fish & seafood': 0.3,
      'berries': 0.4,
      
      // Very loose categories - broad categories where individual items vary significantly
      'fresh fruit': 0.2,
      'fresh fruits': 0.2,
      'fresh vegetables': 0.2,
      'fresh vegetable': 0.2,
      'produce': 0.2,
      'organic produce': 0.2,
      'meat & seafood': 0.2,
      'herbs, spices & seasonings': 0.1,
      
      // Department level categories (very loose)
      'dairy': 0.3,
      'beverages': 0.3,
      'snacks': 0.3,
      'candy': 0.3,
      'frozen foods': 0.3,
      'bakery & bread': 0.3,
      'pantry staples': 0.2,
      'cooking & baking supplies': 0.2,
      'breakfast & cereal': 0.3,
      'baby food': 0.3,
      'fresh & perishable': 0.1
    };

    // Populate the map
    Object.entries(categoryMappings).forEach(([category, strictness]) => {
      this.categoryStrictnessMap.set(category.toLowerCase(), strictness);
    });
  }

  private calculateCategoryStrictness(categories: string[]): number {
    if (categories.length === 0) return 0.5; // Default to moderate

    let totalStrictness = 0;
    let matchedCategories = 0;

    for (const category of categories) {
      const categoryLower = category.toLowerCase();
      
      // Direct match
      if (this.categoryStrictnessMap.has(categoryLower)) {
        totalStrictness += this.categoryStrictnessMap.get(categoryLower)!;
        matchedCategories++;
        continue;
      }

      // Partial match - check if category contains mapped terms
      let found = false;
      for (const [mappedCategory, strictness] of this.categoryStrictnessMap.entries()) {
        if (categoryLower.includes(mappedCategory) || mappedCategory.includes(categoryLower)) {
          totalStrictness += strictness;
          matchedCategories++;
          found = true;
          break;
        }
      }

      // If no match found, use heuristics
      if (!found) {
        const heuristicStrictness = this.calculateHeuristicStrictness(categoryLower);
        totalStrictness += heuristicStrictness;
        matchedCategories++;
      }
    }

    return matchedCategories > 0 ? totalStrictness / matchedCategories : 0.5;
  }

  private calculateHeuristicStrictness(category: string): number {
    // Heuristic rules for categories not in our explicit mapping
    const looseCues = ['fresh', 'organic', 'natural', 'premium', 'gourmet', 'artisan', 'specialty'];
    const strictCues = ['brand', 'flavor', 'size', 'pack', 'bottle', 'can', 'box'];
    
    let score = 0.5; // Start neutral

    // Check for loose indicators
    for (const cue of looseCues) {
      if (category.includes(cue)) {
        score -= 0.2;
        break;
      }
    }

    // Check for strict indicators  
    for (const cue of strictCues) {
      if (category.includes(cue)) {
        score += 0.2;
        break;
      }
    }

    // Length heuristic - very specific category names tend to be stricter
    if (category.split(' ').length === 1 && category.length < 8) {
      score += 0.1; // Short, single words like "milk", "eggs" tend to be strict
    }

    return Math.max(0.1, Math.min(0.9, score));
  }

  async getProductDetails(productId: string) {
    const { data, error } = await this.supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        upc,
        brand:brands(name),
        product_categories!inner(
          category:categories!inner(
            id,
            name,
            slug
          )
        ),
        listings(
          id,
          price,
          currency,
          in_stock,
          url,
          retailer:retailers(name),
          image_url
        )
      `)
      .eq('id', productId)
      .single();

    if (error) throw error;
    return data;
  }

  async searchSimilarProducts(
    original: any,
    limit = 25,
    openai?: OpenAI
  ) {
    const supabase = this.supabase;

    // Get categories from the original product
    const categoryIds = original.product_categories.map(
      (pc: any) => pc.category.id
    );
    const categoryNames = original.product_categories.map(
      (pc: any) => pc.category.name
    );

    console.log(`Searching for alternatives in categories:`, categoryNames);

    // Calculate strictness score based on category analysis
    const strictnessScore = this.calculateCategoryStrictness(categoryNames);
    console.log(`Category strictness score: ${strictnessScore.toFixed(2)} (0.0=loose, 1.0=strict)`);

    // Use strictness threshold to determine search strategy
    const isStrictCategory = strictnessScore >= 0.6; // Threshold for strict vs loose search
    
    if (isStrictCategory) {
      // For strict categories - use simple category search with randomization
      console.log('Using strict search strategy (simple category search)');
      return await this.searchStrictAlternatives(original, categoryIds, limit);
    } else {
      // For loose categories - use complex multi-strategy approach
      console.log('Using loose search strategy (complex multi-strategy)');
      return await this.searchLooseAlternatives(original, categoryIds, limit, strictnessScore, openai);
    }
  }

  async searchStrictAlternatives(original: any, categoryIds: string[], limit: number) {
    const supabase = this.supabase;
    
    console.log('Using strict search strategy - focused category search');
    
    // Get all products in the same categories, excluding same brand and UPC
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        upc,
        brand:brands(name),
        product_categories!inner(
          category:categories!inner(
            id,
            name,
            slug
          )
        ),
        listings(
          id,
          price,
          currency,
          in_stock,
          url,
          retailer:retailers(name),
          image_url
        )
      `)
      .in('product_categories.category_id', categoryIds)
      .neq('id', original.id)
      .not('upc', 'eq', original.upc)
      .limit(limit * 4); // Get more for randomization

    if (error) {
      console.error('Strict search error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter out same brand to encourage diversity
    const originalBrand = original.brand?.name;
    const differentBrandProducts = data.filter(product => {
      const productBrand = product.brand?.name;
      return !originalBrand || productBrand !== originalBrand;
    });

    // Randomize the selection to provide variety
    const shuffled = this.shuffleArray([...differentBrandProducts]);
    return shuffled.slice(0, limit);
  }

  async searchLooseAlternatives(original: any, categoryIds: string[], limit: number, strictnessScore: number, openai?: OpenAI) {
    console.log(`Using loose search strategy - LLM keyword extraction primary (strictness: ${strictnessScore.toFixed(2)})`);
    
    // Strategy 1: LLM-powered name-based search (PRIMARY for loose categories)
    console.log('Using LLM keyword extraction as primary strategy for loose category...');
    const nameBasedAlternatives = await this.searchByLLMExtractedTerms(original, Math.floor(limit * 0.8), openai);
    let allAlternatives = [...nameBasedAlternatives];
    let uniqueAlternatives = this.deduplicateProducts(allAlternatives);

    // Strategy 2: If LLM search didn't find enough, try exclusive category search (but limited)
    if (uniqueAlternatives.length < limit * 0.6) {
      console.log('LLM search insufficient, supplementing with exclusive category search...');
      const categoryAlternatives = await this.searchByCategoryExclusive(original, categoryIds, Math.floor(limit * 0.3));
      allAlternatives = [...uniqueAlternatives, ...categoryAlternatives];
      uniqueAlternatives = this.deduplicateProducts(allAlternatives);
    }

    // Strategy 3: Final fallback - brand diversity within same categories (very limited)
    if (uniqueAlternatives.length < limit * 0.4) {
      console.log('Still need more alternatives, adding brand diversity...');
      const brandAlternatives = await this.searchDifferentBrandsExclusive(original, categoryIds, Math.floor(limit * 0.2));
      allAlternatives = [...uniqueAlternatives, ...brandAlternatives];
      uniqueAlternatives = this.deduplicateProducts(allAlternatives);
    }

    console.log(`Found ${uniqueAlternatives.length} unique alternatives using LLM-primary loose strategy`);
    return uniqueAlternatives.slice(0, limit);
  }

  shuffleArray(array: any[]): any[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Check if a product exclusively belongs to target categories (not mixed with unrelated ones)
  private isProductExclusiveToCategories(product: any, targetCategoryIds: string[]): boolean {
    const productCategoryIds = product.product_categories?.map((pc: any) => pc.category.id) || [];
    
    // If product has no categories, exclude it
    if (productCategoryIds.length === 0) return false;
    
    // Check if at least 80% of the product's categories overlap with target categories
    const overlappingCategories = productCategoryIds.filter(id => targetCategoryIds.includes(id));
    const overlapRatio = overlappingCategories.length / productCategoryIds.length;
    
    return overlapRatio >= 0.8; // At least 80% of categories should match
  }

  async searchByCategoryExclusive(original: any, categoryIds: string[], limit: number) {
    const supabase = this.supabase;
    
    console.log('Using exclusive category search - filtering for category purity');
    
    // Get products in the same categories with more results for filtering
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        upc,
        brand:brands(name),
        product_categories!inner(
          category:categories!inner(
            id,
            name,
            slug
          )
        ),
        listings(
          id,
          price,
          currency,
          in_stock,
          url,
          retailer:retailers(name),
          image_url
        )
      `)
      .in('product_categories.category_id', categoryIds)
      .neq('id', original.id)
      .not('upc', 'eq', original.upc)
      .limit(limit * 5); // Get more to allow for filtering

    if (error) {
      console.error('Exclusive category search error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter for category exclusivity and brand diversity
    const originalBrand = original.brand?.name;
    const exclusiveProducts = data.filter(product => {
      // Check category exclusivity
      if (!this.isProductExclusiveToCategories(product, categoryIds)) {
        return false;
      }
      
      // Check brand diversity
      const productBrand = product.brand?.name;
      return !originalBrand || productBrand !== originalBrand;
    });

    console.log(`Filtered ${data.length} products to ${exclusiveProducts.length} exclusive alternatives`);
    return exclusiveProducts.slice(0, limit);
  }

  async searchDifferentBrandsExclusive(original: any, categoryIds: string[], limit: number) {
    const supabase = this.supabase;
    
    console.log('Using exclusive brand diversity search');
    
    // Find products in categories, grouped by brand
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        upc,
        brand:brands(name),
        product_categories!inner(
          category:categories!inner(
            id,
            name,
            slug
          )
        ),
        listings(
          id,
          price,
          currency,
          in_stock,
          url,
          retailer:retailers(name),
          image_url
        )
      `)
      .in('product_categories.category_id', categoryIds)
      .neq('id', original.id)
      .not('upc', 'eq', original.upc)
      .limit(limit * 3);

    if (error) {
      console.error('Exclusive brand diversity search error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter for exclusivity first
    const exclusiveProducts = data.filter(product => 
      this.isProductExclusiveToCategories(product, categoryIds)
    );

    // Group by brand and take 1-2 from each for diversity
    const originalBrand = original.brand?.name;
    const brandGroups = exclusiveProducts.reduce((groups: any, product: any) => {
      const brandName = product.brand?.name || 'Unknown';
      if (brandName !== originalBrand) {
        if (!groups[brandName]) groups[brandName] = [];
        groups[brandName].push(product);
      }
      return groups;
    }, {});

    // Sample from different brands
    const diverseProducts: any[] = [];
    const brandsToSample = Object.keys(brandGroups).slice(0, Math.max(3, limit));
    
    for (const brand of brandsToSample) {
      const productsFromBrand = brandGroups[brand].slice(0, 2);
      diverseProducts.push(...productsFromBrand);
      if (diverseProducts.length >= limit) break;
    }

    console.log(`Found ${diverseProducts.length} brand-diverse exclusive alternatives`);
    return diverseProducts.slice(0, limit);
  }

  async searchByLLMExtractedTerms(original: any, limit: number, openai?: OpenAI) {
    console.log('Using LLM-powered search term extraction for product name analysis');
    
    if (!openai) {
      console.log('No OpenAI instance provided, skipping LLM search');
      return this.fallbackNameSearch(original, limit);
    }
    
    try {
      
      const extractionPrompt = `Extract the most important search terms from this product name for finding similar products. Focus on the core product type, not brand, size, or packaging details.

Product name: "${original.name}"

Return ONLY a JSON object with a "terms" array containing 2-4 key search terms, RANKED BY IMPORTANCE (most important first):

Examples:
"Shredded Iceberg Lettuce - 8oz - Good & Gather" → {"terms": ["lettuce", "iceberg", "shredded"]}
"Oikos REMIX Greek Yogurt - 4.5oz" → {"terms": ["yogurt", "greek"]}
"Organic Baby Spinach - 5oz" → {"terms": ["spinach", "baby", "organic"]}
"Roma Tomatoes - 2lb" → {"terms": ["tomatoes", "roma"]}

The first term should be the most essential product type (e.g., "lettuce", "yogurt", "spinach", "tomatoes").`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: extractionPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 100
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(response);
      const searchTerms = parsed.terms || [];
      
      console.log(`Extracted search terms: [${searchTerms.join(', ')}]`);
      
      if (searchTerms.length === 0) {
        return [];
      }

      // Use progressive search strategy with extracted terms
      const supabase = this.supabase;
      
      // Strategy 1: Try fuzzy search with individual terms
      let allResults: any[] = await this.searchWithProgressiveTerms(supabase, original, searchTerms, limit);
      
      // Strategy 2: If fuzzy search fails, try progressive ilike search
      if (allResults.length === 0) {
        console.log('Fuzzy search failed, trying progressive ilike search...');
        allResults = await this.searchWithProgressiveIlike(supabase, original, searchTerms, limit);
      }

      // Deduplicate and filter by brand diversity
      const uniqueResults = this.deduplicateProducts(allResults);
      const originalBrand = original.brand?.name;
      const diverseResults = uniqueResults.filter(product => {
        const productBrand = product.brand?.name;
        return !originalBrand || productBrand !== originalBrand;
      });

      console.log(`LLM search found ${diverseResults.length} alternatives using extracted terms`);
      return diverseResults.slice(0, limit);

    } catch (error) {
      console.error('LLM-powered search failed:', error);
      return this.fallbackNameSearch(original, limit);
    }
  }

  async searchWithProgressiveTerms(supabase: any, original: any, searchTerms: string[], limit: number): Promise<any[]> {
    console.log('Trying progressive fuzzy search with individual terms...');
    
    const allResults: any[] = [];
    
    // Try each term individually, starting with most important
    for (const term of searchTerms.slice(0, 3)) {
      console.log(`Searching fuzzy for term: "${term}"`);
      
      try {
        const { data, error } = await supabase.rpc('fuzzy_search_products', {
          search_term: term,
          similarity_threshold: 0.3,
          result_limit: Math.ceil(limit / searchTerms.length) + 2
        });

        if (!error && data && data.length > 0) {
          const productIds = data.map((p: any) => p.id);
          const { data: fullProducts, error: detailError } = await supabase
            .from('products')
            .select(`
              id,
              name,
              slug,
              upc,
              brand:brands(name),
              product_categories(
                category:categories(
                  id,
                  name,
                  slug
                )
              ),
              listings(
                id,
                price,
                currency,
                in_stock,
                url,
                retailer:retailers(name),
                image_url
              )
            `)
            .in('id', productIds)
            .neq('id', original.id)
            .not('upc', 'eq', original.upc);

          if (!detailError && fullProducts) {
            allResults.push(...fullProducts);
            console.log(`Found ${fullProducts.length} products for term "${term}"`);
          }
        }
      } catch (err) {
        console.error(`Error in fuzzy search for term "${term}":`, err);
      }
    }
    
    console.log(`Progressive fuzzy search found ${allResults.length} total results`);
    return allResults;
  }

  async searchWithProgressiveIlike(supabase: any, original: any, searchTerms: string[], limit: number): Promise<any[]> {
    console.log('Trying progressive ilike search - starting with most important term...');
    
    // Progressive search patterns: start with most important term, then try combinations
    const searchPatterns = [
      searchTerms[0], // Just the most important term (e.g., "lettuce")
      searchTerms.slice(0, 2).join(' '), // First two terms (e.g., "lettuce iceberg")
      searchTerms.join(' ') // All terms (e.g., "lettuce iceberg shredded")
    ].filter(pattern => pattern && pattern.trim());

    for (const pattern of searchPatterns) {
      console.log(`Trying ilike search for pattern: "${pattern}"`);
      
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            id,
            name,
            slug,
            upc,
            brand:brands(name),
            product_categories(
              category:categories(
                id,
                name,
                slug
              )
            ),
            listings(
              id,
              price,
              currency,
              in_stock,
              url,
              retailer:retailers(name),
              image_url
            )
          `)
          .ilike('name', `%${pattern}%`)
          .neq('id', original.id)
          .not('upc', 'eq', original.upc)
          .limit(limit * 2);

        if (!error && data && data.length > 0) {
          console.log(`Progressive ilike search found ${data.length} results for pattern "${pattern}"`);
          return data;
        }
      } catch (err) {
        console.error(`Error in ilike search for pattern "${pattern}":`, err);
      }
    }

    console.log('All progressive search patterns failed');
    return [];
  }

  async fallbackNameSearch(original: any, limit: number) {
    console.log('Using fallback name-based search');
    
    // Fallback to simple name-based search using ilike
    const supabase = this.supabase;
    
    // Extract simple terms from product name (fallback heuristic)
    const nameWords = original.name.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word: string) => word.length > 2 && !['the', 'and', 'with', 'for'].includes(word))
      .slice(0, 3);

    if (nameWords.length === 0) {
      return [];
    }

    try {
      const searchTerm = nameWords[0]; // Use the first meaningful word
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          upc,
          brand:brands(name),
          product_categories(
            category:categories(
              id,
              name,
              slug
            )
          ),
          listings(
            id,
            price,
            currency,
            in_stock,
            url,
            retailer:retailers(name),
            image_url
          )
        `)
        .ilike('name', `%${searchTerm}%`)
        .neq('id', original.id)
        .not('upc', 'eq', original.upc)
        .limit(limit * 2);

      if (error) {
        console.error('Fallback search error:', error);
        return [];
      }

      // Filter for brand diversity
      const originalBrand = original.brand?.name;
      const diverseResults = (data || []).filter(product => {
        const productBrand = product.brand?.name;
        return !originalBrand || productBrand !== originalBrand;
      });

      console.log(`Fallback search found ${diverseResults.length} alternatives`);
      return diverseResults.slice(0, limit);

    } catch (fallbackError) {
      console.error('Fallback search also failed:', fallbackError);
      return [];
    }
  }

  async searchByCategory(original: any, categoryIds: string[], limit: number) {
    const supabase = this.supabase;
    
    // Search within same categories but prioritize different brands and price ranges
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        upc,
        brand:brands(name),
        product_categories!inner(
          category:categories!inner(
            id,
            name,
            slug
          )
        ),
        listings(
          id,
          price,
          currency,
          in_stock,
          url,
          retailer:retailers(name),
          image_url
        )
      `)
      .in('product_categories.category_id', categoryIds)
      .neq('id', original.id)
      .not('upc', 'eq', original.upc) // Exclude same UPC
      .limit(limit * 3) // Get more to allow for filtering
      .order('created_at', { ascending: false }); // Get newer products first

    if (error) {
      console.error('Category search error:', error);
      return [];
    }

    // Filter out products from the same brand to encourage diversity
    const originalBrand = original.brand?.name;
    return (data || [])
      .filter(product => {
        const productBrand = product.brand?.name;
        return !originalBrand || productBrand !== originalBrand;
      })
      .slice(0, limit);
  }

  async searchDifferentBrands(original: any, categoryIds: string[], limit: number) {
    const supabase = this.supabase;
    
    // Find popular brands in these categories (excluding the original brand)
    const originalBrand = original.brand?.name;
    
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        upc,
        brand:brands(name),
        product_categories!inner(
          category:categories!inner(
            id,
            name,
            slug
          )
        ),
        listings(
          id,
          price,
          currency,
          in_stock,
          url,
          retailer:retailers(name),
          image_url
        )
      `)
      .in('product_categories.category_id', categoryIds)
      .neq('id', original.id)
      .not('upc', 'eq', original.upc)
      .limit(limit * 2);

    if (error) {
      console.error('Brand diversity search error:', error);
      return [];
    }

    // Group by brand and take a few from each brand
    const brandGroups = (data || []).reduce((groups: any, product: any) => {
      const brandName = product.brand?.name || 'Unknown';
      if (brandName !== originalBrand) {
        if (!groups[brandName]) groups[brandName] = [];
        groups[brandName].push(product);
      }
      return groups;
    }, {});

    // Take 1-2 products from each brand to maximize diversity
    const diverseProducts: any[] = [];
    const brandsToSample = Object.keys(brandGroups).slice(0, Math.max(5, limit));
    
    for (const brand of brandsToSample) {
      const productsFromBrand = brandGroups[brand].slice(0, 2);
      diverseProducts.push(...productsFromBrand);
      if (diverseProducts.length >= limit) break;
    }

    return diverseProducts.slice(0, limit);
  }

  async searchByVectorSimilarity(original: any, categoryIds: string[], limit: number) {
    // Skip vector similarity for now since the function doesn't exist
    // This search strategy will be disabled until embeddings are properly set up
    console.log('Skipping vector similarity search - function not available');
    return [];
    
    /* Future implementation when embeddings are available:
    const supabase = this.supabase;

    try {
      const { data, error } = await supabase.rpc('fuzzy_search_products', {
        search_term: original.name,
        category_ids: categoryIds,
        limit_count: limit
      });

      if (error) {
        console.error('Vector search error:', error);
        return [];
      }

      return (data || []).filter((product: any) => 
        product.id !== original.id && product.upc !== original.upc
      );
    } catch (err) {
      console.error('Vector search failed:', err);
      return [];
    }
    */
  }

  deduplicateProducts(products: any[]) {
    const seen = new Set<string>();
    return products.filter(product => {
      if (seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    });
  }

  async searchParentCategories(original: any, limit: number) {
    const supabase = this.supabase;
    
    // Get parent categories for the original product's categories
    const originalCategoryIds = original.product_categories.map((pc: any) => pc.category.id);
    
    const { data: parentCategories, error: parentError } = await supabase
      .from('categories')
      .select('parent_id, name')
      .in('id', originalCategoryIds)
      .not('parent_id', 'is', null);

    if (parentError || !parentCategories?.length) {
      console.log('No parent categories found');
      return [];
    }

    const parentIds = [...new Set(parentCategories.map(cat => cat.parent_id))];
    console.log('Searching parent categories for broader alternatives');
    
    // Search for products in parent categories (broader search)
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        upc,
        brand:brands(name),
        product_categories!inner(
          category:categories!inner(
            id,
            name,
            slug
          )
        ),
        listings(
          id,
          price,
          currency,
          in_stock,
          url,
          retailer:retailers(name),
          image_url
        )
      `)
      .in('product_categories.category_id', parentIds)
      .neq('id', original.id)
      .not('upc', 'eq', original.upc)
      .limit(limit * 2);

    if (error) {
      console.error('Parent category search error:', error);
      return [];
    }

    // Filter for brand diversity
    const originalBrand = original.brand?.name;
    return (data || [])
      .filter(product => {
        const productBrand = product.brand?.name;
        return !originalBrand || productBrand !== originalBrand;
      })
      .slice(0, limit);
  }
}

async function findAlternativesWithOpenAI(
  openai: OpenAI,
  originalProduct: any,
  similarProducts: any[]
): Promise<ProductAlternative[]> {
  const originalCategories = originalProduct.product_categories?.map((pc: any) => pc.category?.name) || [];
  const originalBrand = originalProduct.brand?.name || 'Unknown';

  const systemPrompt = `You are an AI assistant that helps find product alternatives for grocery shopping. Your goal is to identify products that could serve as good substitutes or alternatives to the original product.

FOCUS ON FINDING TRUE ALTERNATIVES, not just similar products. Look for:
- Different brands offering similar functionality
- Products that solve the same problem/need
- Items that could be used interchangeably 
- Value alternatives (better price/quality ratio)
- Healthier or premium alternatives

Original Product: "${originalProduct.name}" 
- Brand: ${originalBrand}
- Categories: ${originalCategories.join(', ')}

Candidate Products to evaluate:
${similarProducts.map((p, i) => {
  const categories = p.product_categories?.map((pc: any) => pc.category?.name) || [];
  const brand = p.brand?.name || 'Unknown';
  const bestPrice = p.listings?.filter((l: any) => l.price !== null).reduce((min: any, listing: any) => 
    !min || listing.price < min.price ? listing : min, null);
  const retailers = [...new Set(p.listings?.map((l: any) => l.retailer?.name).filter(Boolean))];
  
  return `${i + 1}. PRODUCT_ID: ${p.id}
   - Name: "${p.name}"
   - Brand: ${brand}
   - Categories: ${categories.join(', ')}
   - Price: ${bestPrice?.price ? '$' + bestPrice.price.toFixed(2) : 'N/A'}
   - Available at: ${retailers.join(', ') || 'N/A'}`;
}).join('\n\n')}

Rate each product as an alternative based on:
1. **Substitutability**: Can this replace the original product for its intended use?
2. **Value proposition**: Does it offer better value, quality, or features?
3. **Brand diversity**: Prefer different brands to give shoppers options
4. **Availability**: Is it readily available and in stock?
5. **Category relevance**: Does it fit the same use case/need?

Assign confidence levels:
- HIGH: Excellent alternative, very interchangeable
- MEDIUM: Good alternative with some trade-offs  
- LOW: Possible alternative but significant differences

CRITICAL: Use the exact PRODUCT_ID from the list above. Do not modify or interpret the ID.

Return EXACTLY 5 alternatives in this JSON format:
{
  "alternatives": [
    {
      "product_id": "EXACT_PRODUCT_ID_FROM_LIST_ABOVE",
      "confidence": "high|medium|low", 
      "reason": "specific explanation of why this is a good alternative (mention value, brand, features, etc.)",
      "similarity_score": 0.0-1.0
    }
  ]
}

Example: If you see "PRODUCT_ID: abc-123-def" in the list, use exactly "abc-123-def" as the product_id.`;

  try {
    // Add timeout to prevent long waits
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('AI processing timeout')), 15000) // 15 second timeout
    );

    const aiPromise = openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1000 // Reduced for faster processing
    });

    const completion = await Promise.race([aiPromise, timeoutPromise]) as any;

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(response);
    return parsed.alternatives || [];
  } catch (error) {
    console.error('OpenAI error:', error);
    
    // Fallback: return top similar products as basic alternatives
    console.log('Using fallback: returning top similar products as alternatives');
    return similarProducts.slice(0, 5).map((product, index) => {
      const bestListing = product.listings?.filter((l: any) => l.price !== null)
        .reduce((min: any, listing: any) => 
          !min || listing.price < min.price ? listing : min, null);
      
      return {
        product_id: product.id,
        product_name: product.name,
        brand: product.brand?.name,
        price: bestListing?.price,
        retailer: bestListing?.retailer?.name,
        confidence: index < 2 ? 'high' : index < 4 ? 'medium' : 'low' as const,
        reason: `Similar product in the same category (${product.product_categories?.map((pc: any) => pc.category?.name).join(', ') || 'same category'})`,
        image_url: product.listings?.find((l: any) => l.image_url)?.image_url,
        similarity_score: Math.max(0.3, 1.0 - (index * 0.15)) // Decreasing score
      };
    });
  }
}

function enrichAlternatives(aiAlternatives: any[], similarProducts: any[]): ProductAlternative[] {
  console.log(`Enriching ${aiAlternatives.length} AI alternatives from ${similarProducts.length} similar products`);
  
  const enriched = aiAlternatives.map((alt, index) => {
    console.log(`Processing alternative ${index + 1}: product_id = ${alt.product_id}`);
    
    const product = similarProducts.find(p => p.id === alt.product_id);
    if (!product) {
      console.log(`Product with ID ${alt.product_id} not found in similar products`);
      return null;
    }

    const bestListing = product.listings?.filter((l: any) => l.price !== null)
      .reduce((min: any, listing: any) => 
        !min || listing.price < min.price ? listing : min, null);

    const enrichedAlt = {
      product_id: product.id,
      product_name: product.name,
      brand: product.brand?.name,
      price: bestListing?.price,
      retailer: bestListing?.retailer?.name,
      confidence: alt.confidence,
      reason: alt.reason,
      image_url: product.listings?.find((l: any) => l.image_url)?.image_url,
      similarity_score: alt.similarity_score || 0.5
    };
    
    console.log(`Enriched alternative: ${enrichedAlt.product_name} - ${enrichedAlt.brand} - $${enrichedAlt.price}`);
    return enrichedAlt;
  }).filter(Boolean) as ProductAlternative[];
  
  console.log(`Successfully enriched ${enriched.length} alternatives`);
  return enriched;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const { product_id } = await req.json();

    if (!product_id) {
      return new Response(
        JSON.stringify({ error: 'Missing product_id' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });
    const dbHelpers = new AlternativesHelpers(supabase);

    // Get original product details
    console.log('Fetching product details for ID:', product_id);
    const originalProduct = await dbHelpers.getProductDetails(product_id);
    console.log('Original product found:', originalProduct?.name);

    // Search for similar products
    const similarProducts = await dbHelpers.searchSimilarProducts(
      originalProduct,
      20, // Get more candidates for AI to choose from
      openai // Pass OpenAI instance for LLM-powered fallback search
    );

    console.log(`Found ${similarProducts.length} similar products for AI evaluation`);

    if (similarProducts.length === 0) {
      console.log('No similar products found, returning empty alternatives');
      return new Response(
        JSON.stringify({
          alternatives: [],
          original_product: {
            id: originalProduct.id,
            name: originalProduct.name,
            brand: originalProduct.brand?.name
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Use AI to find best alternatives
    console.log('Sending products to OpenAI for evaluation...');
    const aiAlternatives = await findAlternativesWithOpenAI(
      openai,
      originalProduct,
      similarProducts
    );

    console.log(`OpenAI returned ${aiAlternatives.length} alternatives`);

    // Enrich alternatives with full product data
    const enrichedAlternatives = enrichAlternatives(aiAlternatives, similarProducts);
    console.log(`Enriched ${enrichedAlternatives.length} alternatives with full data`);

    const response: AlternativesResponse = {
      alternatives: enrichedAlternatives.slice(0, 5), // Ensure max 5 alternatives
      original_product: {
        id: originalProduct.id,
        name: originalProduct.name,
        brand: originalProduct.brand?.name
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in ai-alternatives function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});