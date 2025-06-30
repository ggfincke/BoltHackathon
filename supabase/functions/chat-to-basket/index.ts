import { createClient } from 'npm:@supabase/supabase-js@2.42.0';
import OpenAI from 'npm:openai@4.28.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

interface ParsedFoodChat {
  ingredients: Ingredient[];
  summary: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ProductMatch {
  ingredient: string;
  product_id: string;
  product_name: string;
  confidence: 'high' | 'medium' | 'low';
  confidence_reason: string;
  quantity: number;
  unit: string | null;
  alternatives?: {
    product_id: string;
    product_name: string;
    confidence: 'high' | 'medium' | 'low';
  }[];
}

interface ChatToBasketResponse {
  basket_id: string;
  matches: ProductMatch[];
  unmatched: string[];
  summary: string;
}

// Database helper functions
class DatabaseHelpers {
  constructor(private supabase: any) {}

  async searchProductsByName(searchTerm: string, limit: number = 5) {
    // Automatically apply category-aware filtering by default
    const guessedCategory = this.guessSimpleCategory(searchTerm);
    return this.searchProductsByNameWithCategoryFilter(searchTerm, guessedCategory, limit);
  }

  async searchProductsByNameRaw(searchTerm: string, limit: number = 5) {
    const { data, error } = await this.supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        product_categories!inner(
          category:categories!inner(
            id,
            name,
            slug
          )
        )
      `)
      .textSearch('name', searchTerm, { 
        type: 'websearch',
        config: 'english' 
      })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  private guessSimpleCategory(searchTerm: string): string | null {
    const term = searchTerm.toLowerCase();
    
    console.log(`[CATEGORY GUESS] Analyzing term: "${term}"`);
    
    // Map to exact category names from categories.json
    if (term.includes('bread') && !term.includes('breaded')) {
      console.log(`[CATEGORY GUESS] "${term}" -> "Breads" (bakery category)`);
      return 'Breads';
    }
    if (term.includes('chicken') && !term.includes('flavored')) {
      console.log(`[CATEGORY GUESS] "${term}" -> "Chicken" (meat category)`);
      return 'Chicken';
    }
    if (term.includes('cheese') && !term.includes('flavored') && !term.includes('crackers')) {
      console.log(`[CATEGORY GUESS] "${term}" -> "Cheese" (dairy category)`);
      return 'Cheese';
    }
    if (term.includes('lettuce')) {
      console.log(`[CATEGORY GUESS] "${term}" -> "Fresh Vegetables" (produce category)`);
      return 'Fresh Vegetables';
    }
    if (term.includes('tomato')) {
      console.log(`[CATEGORY GUESS] "${term}" -> "Fresh Vegetables" (produce category)`);
      return 'Fresh Vegetables';
    }
    if (term.includes('bacon')) {
      console.log(`[CATEGORY GUESS] "${term}" -> "Bacon" (meat category)`);
      return 'Bacon';
    }
    if (term.includes('ham') || term.includes('beef')) {
      console.log(`[CATEGORY GUESS] "${term}" -> "Beef" (meat category)`);
      return 'Beef';
    }
    if (term.includes('milk')) {
      console.log(`[CATEGORY GUESS] "${term}" -> "Milk" (dairy category)`);
      return 'Milk';
    }
    if (term.includes('yogurt')) {
      console.log(`[CATEGORY GUESS] "${term}" -> "Yogurt" (dairy category)`);
      return 'Yogurt';
    }
    if (term.includes('butter')) {
      console.log(`[CATEGORY GUESS] "${term}" -> "Butter & Margarine" (dairy category)`);
      return 'Butter & Margarine';
    }
    
    console.log(`[CATEGORY GUESS] "${term}" -> null (no category match)`);
    return null;
  }

  async searchProductsByNameWithCategoryFilter(searchTerm: string, expectedCategory: string | null, limit: number = 5) {
    console.log(`[CATEGORY FILTER] Searching for "${searchTerm}" with expected category: "${expectedCategory}"`);
    
    // First, do a regular name search
    const allResults = await this.searchProductsByNameRaw(searchTerm, limit * 3);
    console.log(`[CATEGORY FILTER] Found ${allResults.length} total results for "${searchTerm}"`);
    
    if (!expectedCategory || allResults.length === 0) {
      console.log(`[CATEGORY FILTER] No category filtering - returning ${Math.min(allResults.length, limit)} results`);
      return allResults.slice(0, limit);
    }

    // Filter and rank results based on category relevance
    const categoryRelevantResults: any[] = [];
    const categoryIrrelevantResults: any[] = [];

    for (const product of allResults) {
      const productCategories = product.product_categories?.map((pc: any) => pc.category?.name) || [];
      console.log(`[CATEGORY FILTER] Product "${product.name}" has categories: [${productCategories.join(', ')}]`);
      
      const isRelevant = this.isCategoryRelevant(expectedCategory, productCategories);
      console.log(`[CATEGORY FILTER] Product "${product.name}" is ${isRelevant ? 'RELEVANT' : 'IRRELEVANT'} for category "${expectedCategory}"`);
      
      if (isRelevant) {
        categoryRelevantResults.push(product);
      } else {
        categoryIrrelevantResults.push(product);
      }
    }

    console.log(`[CATEGORY FILTER] Relevant results: ${categoryRelevantResults.length}, Irrelevant: ${categoryIrrelevantResults.length}`);
    
    // Return category-relevant results first, then others
    const combinedResults = [...categoryRelevantResults, ...categoryIrrelevantResults];
    console.log(`[CATEGORY FILTER] Final result order: ${combinedResults.slice(0, limit).map(p => p.name).join(' | ')}`);
    return combinedResults.slice(0, limit);
  }

  private isCategoryRelevant(expectedCategory: string, productCategories: string[]): boolean {
    console.log(`[CATEGORY RELEVANCE] Checking if expected "${expectedCategory}" matches product categories: [${productCategories.join(', ')}]`);
    
    // Check for exact category matches (case-insensitive)
    for (const category of productCategories) {
      if (category.toLowerCase() === expectedCategory.toLowerCase()) {
        console.log(`[CATEGORY RELEVANCE] EXACT MATCH: ${category} === ${expectedCategory}`);
        return true;
      }
    }

    // Check for partial matches and category group relationships
    // Map expected categories to possible variations and related categories
    const categoryMappings: Record<string, string[]> = {
      // Exact leaf categories from categories.json
      'Breads': ['Breads', 'Bakery & Bread'],
      'Bagels & Muffins': ['Bagels & Muffins', 'Bakery & Bread'],
      'Chicken': ['Chicken', 'Meat & Seafood'],
      'Beef': ['Beef', 'Meat & Seafood'], 
      'Fish & Seafood': ['Fish & Seafood', 'Meat & Seafood'],
      'Bacon': ['Bacon', 'Meat & Seafood'],
      'Milk': ['Milk', 'Dairy'],
      'Cheese': ['Cheese', 'Dairy'],
      'Eggs': ['Eggs', 'Dairy'],
      'Yogurt': ['Yogurt', 'Dairy'],
      'Butter & Margarine': ['Butter & Margarine', 'Dairy'],
      'Fresh Vegetables': ['Fresh Vegetables', 'Produce'],
      'Fresh Fruit': ['Fresh Fruit', 'Produce'],
      'Berries': ['Berries', 'Produce'],
      'Organic Produce': ['Organic Produce', 'Produce'],
      
      // Also support broader category names
      'Produce': ['Fresh Vegetables', 'Fresh Fruit', 'Berries', 'Organic Produce', 'Produce'],
      'Meat': ['Chicken', 'Beef', 'Fish & Seafood', 'Bacon', 'Meat & Seafood'],
      'Dairy': ['Milk', 'Cheese', 'Eggs', 'Yogurt', 'Butter & Margarine', 'Dairy'],
      'Bakery': ['Breads', 'Bagels & Muffins', 'Bakery & Bread'],
      'Frozen': ['Frozen Foods', 'Frozen Meals', 'Frozen Vegetables', 'Frozen Pizza', 'Ice Cream & Novelties']
    };

    const mappedCategories = categoryMappings[expectedCategory] || [];
    console.log(`[CATEGORY RELEVANCE] Mapped categories for "${expectedCategory}": [${mappedCategories.join(', ')}]`);
    
    for (const mappedCategory of mappedCategories) {
      for (const productCategory of productCategories) {
        if (productCategory.toLowerCase() === mappedCategory.toLowerCase()) {
          console.log(`[CATEGORY RELEVANCE] MAPPED MATCH: ${productCategory} matches mapped ${mappedCategory}`);
          return true;
        }
        // Also check for partial matches
        if (productCategory.toLowerCase().includes(mappedCategory.toLowerCase()) || 
            mappedCategory.toLowerCase().includes(productCategory.toLowerCase())) {
          console.log(`[CATEGORY RELEVANCE] PARTIAL MATCH: ${productCategory} partially matches ${mappedCategory}`);
          return true;
        }
      }
    }

    console.log(`[CATEGORY RELEVANCE] NO MATCH: "${expectedCategory}" not relevant to [${productCategories.join(', ')}]`);
    return false;
  }

  async searchProductsByCategory(categoryName: string, searchTerm?: string, limit: number = 5) {
    let query = this.supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        product_categories!inner(
          category:categories!inner(
            id,
            name,
            slug
          )
        )
      `)
      .eq('product_categories.category.name', categoryName)
      .limit(limit);

    if (searchTerm) {
      query = query.textSearch('name', searchTerm);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async searchByBrandAndTerm(brandName: string, searchTerm: string, limit: number = 5) {
    const { data, error } = await this.supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        brand:brands!inner(
          name
        ),
        product_categories(
          category:categories(
            id,
            name,
            slug
          )
        )
      `)
      .eq('brand.name', brandName)
      .textSearch('name', searchTerm)
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async fuzzySearchProducts(searchTerm: string, limit: number = 5) {
    // Use trigram similarity for fuzzy matching
    const { data, error } = await this.supabase
      .rpc('fuzzy_search_products', {
        search_term: searchTerm,
        similarity_threshold: 0.3,
        result_limit: limit
      });

    if (error) {
      // Fallback to regular text search if fuzzy search fails
      return this.searchProductsByNameWithCategoryFilter(searchTerm, null, limit);
    }
    return data || [];
  }

  async getAvailableCategories() {
    const { data, error } = await this.supabase
      .from('categories')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  }
}

// Smart synonym mapping
const INGREDIENT_SYNONYMS: Record<string, string[]> = {
  'scallions': ['green onions', 'spring onions'],
  'cilantro': ['coriander', 'chinese parsley'],
  'bell pepper': ['sweet pepper', 'capsicum'],
  'zucchini': ['courgette'],
  'eggplant': ['aubergine'],
  'arugula': ['rocket'],
  'romaine': ['romaine lettuce', 'cos lettuce'],
  'ground beef': ['minced beef', 'hamburger meat'],
  'heavy cream': ['heavy whipping cream', 'double cream'],
  'confectioners sugar': ['powdered sugar', 'icing sugar'],
  'baking soda': ['sodium bicarbonate'],
  'vanilla extract': ['vanilla essence'],
};

// Category mapping for intelligent fallbacks
const INGREDIENT_CATEGORIES: Record<string, string[]> = {
  'produce': ['lettuce', 'tomato', 'onion', 'carrot', 'celery', 'potato', 'apple', 'banana', 'orange', 'lemon', 'lime', 'garlic', 'ginger', 'herbs', 'spinach', 'broccoli', 'cucumber', 'bell pepper', 'mushroom'],
  'meat': ['chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'bacon', 'sausage', 'ham'],
  'dairy': ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'eggs', 'sour cream'],
  'pantry': ['flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'pasta', 'rice', 'beans', 'spices', 'vanilla', 'baking powder', 'baking soda'],
  'beverages': ['water', 'juice', 'soda', 'coffee', 'tea', 'wine', 'beer'],
  'frozen': ['frozen vegetables', 'frozen fruit', 'ice cream', 'frozen pizza'],
  'bakery': ['bread', 'rolls', 'bagels', 'muffins', 'cake', 'cookies'],
  'snacks': ['chips', 'crackers', 'nuts', 'candy', 'chocolate']
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Check request size to prevent token overflow
    const contentLength = parseInt(req.headers.get('content-length') || '0');
    if (contentLength > 10240) { // 10KB limit
      return new Response(
        JSON.stringify({ error: 'Request too large. Please send a shorter message.' }),
        {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const { messages, userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize database helpers
    const dbHelpers = new DatabaseHelpers(supabase);

    // Process messages
    let processedMessages: Message[];
    if (typeof messages === 'string') {
      processedMessages = [{ role: 'user', content: messages }];
    } else if (Array.isArray(messages)) {
      processedMessages = messages;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Extract ingredients using OpenAI
    const parsedData = await extractIngredientsWithOpenAI(openai, processedMessages);
    
    // Enhanced matching with orchestration loop
    const { matches, unmatched } = await intelligentMatchIngredients(openai, dbHelpers, parsedData.ingredients);
    
    // Create a new basket
    const basketId = await createBasket(supabase, userId, matches, parsedData.summary);

    // Return the response
    const response: ChatToBasketResponse = {
      basket_id: basketId,
      matches,
      unmatched,
      summary: parsedData.summary
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred' }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

async function extractIngredientsWithOpenAI(openai: OpenAI, messages: Message[]): Promise<ParsedFoodChat> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that extracts food ingredients from user messages. Extract all ingredients mentioned, with quantities and units when available. Be thorough and include all food items, even condiments and seasonings."
      },
      ...messages,
    ],
    functions: [
      {
        name: "parse_food_chat",
        parameters: {
          type: "object",
          properties: {
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: "number", nullable: true },
                  unit: { type: "string", nullable: true }
                },
                required: ["name"]
              }
            },
            summary: { type: "string" }
          },
          required: ["ingredients", "summary"]
        }
      }
    ],
    function_call: { name: "parse_food_chat" }
  });

  const functionCall = response.choices[0]?.message?.function_call;
  if (!functionCall || !functionCall.arguments) {
    throw new Error('Failed to extract ingredients');
  }

  try {
    return JSON.parse(functionCall.arguments) as ParsedFoodChat;
  } catch (error) {
    console.error('Error parsing OpenAI response:', error);
    throw new Error('Failed to parse ingredients data');
  }
}

async function intelligentMatchIngredients(
  openai: OpenAI, 
  dbHelpers: DatabaseHelpers, 
  ingredients: Ingredient[]
): Promise<{ matches: ProductMatch[], unmatched: string[] }> {
  const matches: ProductMatch[] = [];
  const unmatched: string[] = [];

  // Process ingredients in parallel with Promise.all
  const results = await Promise.all(
    ingredients.map(ingredient => matchSingleIngredient(openai, dbHelpers, ingredient))
  );

  // Collect results
  results.forEach(result => {
    if (result.match) {
      matches.push(result.match);
    } else {
      unmatched.push(result.ingredient);
    }
  });

  return { matches, unmatched };
}

async function matchSingleIngredient(
  openai: OpenAI,
  dbHelpers: DatabaseHelpers,
  ingredient: Ingredient
): Promise<{ match?: ProductMatch, ingredient: string }> {
  const maxToolCalls = 4;
  let toolCallCount = 0;
  let bestMatch: any = null;
  let alternatives: any[] = [];

  // Define available tools for the LLM
  const tools = [
    {
      type: "function" as const,
      function: {
        name: "search_products_by_name",
        description: "Full-text search on product names",
        parameters: {
          type: "object",
          properties: {
            searchTerm: { type: "string" },
            limit: { type: "number", default: 5 }
          },
          required: ["searchTerm"]
        }
      }
    },

    {
      type: "function" as const,
      function: {
        name: "search_products_by_category",
        description: "Find products within specific categories",
        parameters: {
          type: "object",
          properties: {
            categoryName: { type: "string" },
            searchTerm: { type: "string" },
            limit: { type: "number", default: 5 }
          },
          required: ["categoryName"]
        }
      }
    },
    {
      type: "function" as const,
      function: {
        name: "search_by_brand_and_term",
        description: "Brand-specific product search",
        parameters: {
          type: "object",
          properties: {
            brandName: { type: "string" },
            searchTerm: { type: "string" },
            limit: { type: "number", default: 5 }
          },
          required: ["brandName", "searchTerm"]
        }
      }
    },
    {
      type: "function" as const,
      function: {
        name: "fuzzy_search_products",
        description: "Trigram similarity search for typos and variants",
        parameters: {
          type: "object",
          properties: {
            searchTerm: { type: "string" },
            limit: { type: "number", default: 5 }
          },
          required: ["searchTerm"]
        }
      }
    },
    {
      type: "function" as const,
      function: {
        name: "get_available_categories",
        description: "List available product categories",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    }
  ];

  // Get synonyms for the ingredient
  const synonyms = getSynonyms(ingredient.name);
  const category = guessCategory(ingredient.name);

  const messages = [
    {
      role: "system" as const,
      content: `You are a grocery shopping assistant. Find the best product match for the ingredient "${ingredient.name}". 
      
      Available synonyms: ${synonyms.join(', ')}
      Likely category: ${category || 'unknown'}
      
      IMPORTANT: All searches now automatically use category-aware filtering to avoid incorrect matches (e.g., "bread" will not match "breaded chicken").
      
      Try these search strategies in order:
      1. Name search (automatically category-filtered) - use search_products_by_name
      2. Category-specific search within the expected category if name search fails
      3. Fuzzy search for typos/variants
      4. Brand-specific search if applicable
      
      Stop when you find a good match or after ${maxToolCalls} attempts.`
    },
    {
      role: "user" as const,
      content: `Find products for ingredient: ${ingredient.name}`
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools,
      tool_choice: "auto",
      max_tokens: 1000
    });

    let currentMessages = [...messages, response.choices[0].message];

    // Process tool calls
    while (response.choices[0].message.tool_calls && toolCallCount < maxToolCalls) {
      const toolCalls = response.choices[0].message.tool_calls;
      
      for (const toolCall of toolCalls) {
        if (toolCallCount >= maxToolCalls) break;
        
        toolCallCount++;
        const result = await executeToolCall(dbHelpers, toolCall);
        
        if (result && result.length > 0) {
          if (!bestMatch) {
            bestMatch = result[0];
          }
          // Allow up to 5 alternative suggestions
          alternatives.push(...result.slice(0, 5)); // Keep top 5 alternatives
        }

        currentMessages.push({
          role: "tool" as const,
          content: JSON.stringify(result),
          tool_call_id: toolCall.id
        });
      }

      // If we found a good match, break early
      if (bestMatch) break;

      // Continue the conversation
      const nextResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: currentMessages,
        tools,
        tool_choice: "auto",
        max_tokens: 500
      });

      if (!nextResponse.choices[0].message.tool_calls) break;
      currentMessages.push(nextResponse.choices[0].message);
    }

    if (bestMatch) {
      // Determine confidence and reasoning
      const productCategories = bestMatch.product_categories?.map((pc: any) => pc.category?.name) || [];
      const { confidence, reason } = determineConfidence(ingredient.name, bestMatch.name, productCategories);
      
      return {
        match: {
          ingredient: ingredient.name,
          product_id: bestMatch.id,
          product_name: bestMatch.name,
          confidence,
          confidence_reason: reason,
          quantity: ingredient.quantity || 1,
          unit: ingredient.unit,
          alternatives: alternatives
            .filter(alt => alt.id !== bestMatch.id)
            // Provide up to 5 alternative suggestions
            .slice(0, 5)
            .map(alt => ({
              product_id: alt.id,
              product_name: alt.name,
              confidence: determineConfidence(ingredient.name, alt.name, alt.product_categories?.map((pc: any) => pc.category?.name) || []).confidence
            }))
        },
        ingredient: ingredient.name
      };
    }

  } catch (error) {
    console.error('Error in intelligent matching:', error);
  }

  return { ingredient: ingredient.name };
}

async function executeToolCall(dbHelpers: DatabaseHelpers, toolCall: any) {
  const { name, arguments: args } = toolCall.function;
  const parsedArgs = JSON.parse(args);

  try {
    switch (name) {
      case 'search_products_by_name':
        return await dbHelpers.searchProductsByName(parsedArgs.searchTerm, parsedArgs.limit);
      

      case 'search_products_by_category':
        return await dbHelpers.searchProductsByCategory(
          parsedArgs.categoryName, 
          parsedArgs.searchTerm, 
          parsedArgs.limit
        );
      
      case 'search_by_brand_and_term':
        return await dbHelpers.searchByBrandAndTerm(
          parsedArgs.brandName, 
          parsedArgs.searchTerm, 
          parsedArgs.limit
        );
      
      case 'fuzzy_search_products':
        return await dbHelpers.fuzzySearchProducts(parsedArgs.searchTerm, parsedArgs.limit);
      
      case 'get_available_categories':
        return await dbHelpers.getAvailableCategories();
      
      default:
        return [];
    }
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return [];
  }
}

function getSynonyms(ingredient: string): string[] {
  const lowerIngredient = ingredient.toLowerCase();
  
  // Check direct synonyms
  if (INGREDIENT_SYNONYMS[lowerIngredient]) {
    return INGREDIENT_SYNONYMS[lowerIngredient];
  }
  
  // Check if ingredient is a synonym of something else
  for (const [key, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
    if (synonyms.some(syn => syn.toLowerCase().includes(lowerIngredient) || lowerIngredient.includes(syn.toLowerCase()))) {
      return [key, ...synonyms];
    }
  }
  
  return [ingredient];
}

function guessCategory(ingredient: string): string | null {
  const lowerIngredient = ingredient.toLowerCase();
  console.log(`[GUESS CATEGORY] Analyzing ingredient: "${ingredient}"`);
  
  // Use the updated mappings to exact category names from categories.json
  if (lowerIngredient.includes('bread') && !lowerIngredient.includes('breaded')) {
    console.log(`[GUESS CATEGORY] "${ingredient}" -> "Breads"`);
    return 'Breads';
  }
  if (lowerIngredient.includes('chicken') && !lowerIngredient.includes('flavored')) {
    console.log(`[GUESS CATEGORY] "${ingredient}" -> "Chicken"`);
    return 'Chicken';
  }
  if (lowerIngredient.includes('cheese') && !lowerIngredient.includes('flavored')) {
    console.log(`[GUESS CATEGORY] "${ingredient}" -> "Cheese"`);
    return 'Cheese';
  }
  if (lowerIngredient.includes('lettuce') || lowerIngredient.includes('tomato') || lowerIngredient.includes('onion')) {
    console.log(`[GUESS CATEGORY] "${ingredient}" -> "Fresh Vegetables"`);
    return 'Fresh Vegetables';
  }
  if (lowerIngredient.includes('bacon')) {
    console.log(`[GUESS CATEGORY] "${ingredient}" -> "Bacon"`);
    return 'Bacon';
  }
  if (lowerIngredient.includes('ham') || lowerIngredient.includes('beef')) {
    console.log(`[GUESS CATEGORY] "${ingredient}" -> "Beef"`);
    return 'Beef';
  }
  if (lowerIngredient.includes('milk')) {
    console.log(`[GUESS CATEGORY] "${ingredient}" -> "Milk"`);
    return 'Milk';
  }
  if (lowerIngredient.includes('yogurt')) {
    console.log(`[GUESS CATEGORY] "${ingredient}" -> "Yogurt"`);
    return 'Yogurt';
  }
  if (lowerIngredient.includes('butter')) {
    console.log(`[GUESS CATEGORY] "${ingredient}" -> "Butter & Margarine"`);
    return 'Butter & Margarine';
  }
  
  // Broader categories for the old INGREDIENT_CATEGORIES items
  for (const [category, items] of Object.entries(INGREDIENT_CATEGORIES)) {
    if (items.some(item => lowerIngredient.includes(item.toLowerCase()) || item.toLowerCase().includes(lowerIngredient))) {
      console.log(`[GUESS CATEGORY] "${ingredient}" -> "${category}" (from legacy mapping)`);
      return category;
    }
  }
  
  console.log(`[GUESS CATEGORY] "${ingredient}" -> null (no match)`);
  return null;
}

function determineConfidence(ingredient: string, productName: string, productCategories?: string[]): { confidence: 'high' | 'medium' | 'low', reason: string } {
  const ingredientLower = ingredient.toLowerCase();
  const productLower = productName.toLowerCase();
  const expectedCategory = guessCategory(ingredient);
  
  console.log(`[CONFIDENCE] Determining confidence for "${ingredient}" -> "${productName}" (categories: [${(productCategories || []).join(', ')}])`);
  
  // Check for problematic cross-category matches
  const isCrossCategoryMatch = checkForCrossCategoryMatch(ingredient, productName, productCategories);
  console.log(`[CONFIDENCE] Cross-category match detected: ${isCrossCategoryMatch}`);
  
  let finalResult: { confidence: 'high' | 'medium' | 'low', reason: string };
  
  // Exact match
  if (ingredientLower === productLower) {
    finalResult = { confidence: 'high', reason: 'Exact name match' };
    console.log(`[CONFIDENCE] Result: ${finalResult.confidence} - ${finalResult.reason}`);
    return finalResult;
  }
  
  // Product name contains ingredient - but check for false positives
  if (productLower.includes(ingredientLower)) {
    if (isCrossCategoryMatch) {
      finalResult = { confidence: 'low', reason: `Contains ingredient but likely wrong category (${ingredient} vs ${productName})` };
    } else {
      finalResult = { confidence: 'high', reason: 'Product name contains ingredient' };
    }
    console.log(`[CONFIDENCE] Result: ${finalResult.confidence} - ${finalResult.reason}`);
    return finalResult;
  }
  
  // Ingredient contains product name (less common but possible)
  if (ingredientLower.includes(productLower)) {
    finalResult = { confidence: 'medium', reason: 'Ingredient contains product name' };
    console.log(`[CONFIDENCE] Result: ${finalResult.confidence} - ${finalResult.reason}`);
    return finalResult;
  }
  
  // Check for synonyms
  const synonyms = getSynonyms(ingredient);
  for (const synonym of synonyms) {
    if (productLower.includes(synonym.toLowerCase()) || synonym.toLowerCase().includes(productLower)) {
      finalResult = { confidence: 'medium', reason: `Synonym match: ${synonym}` };
      console.log(`[CONFIDENCE] Result: ${finalResult.confidence} - ${finalResult.reason}`);
      return finalResult;
    }
  }
  
  // Partial word match - be more careful about false positives
  const ingredientWords = ingredientLower.split(' ');
  const productWords = productLower.split(' ');
  const commonWords = ingredientWords.filter(word => 
    word.length > 2 && // Ignore short words
    productWords.some(pWord => pWord.includes(word) || word.includes(pWord))
  );
  
  if (commonWords.length > 0) {
    if (isCrossCategoryMatch) {
      finalResult = { confidence: 'low', reason: `Partial match but likely wrong category: ${commonWords.join(', ')}` };
    } else {
      finalResult = { confidence: 'medium', reason: `Partial match: ${commonWords.join(', ')}` };
    }
    console.log(`[CONFIDENCE] Result: ${finalResult.confidence} - ${finalResult.reason}`);
    return finalResult;
  }
  
  finalResult = { confidence: 'low', reason: 'Fuzzy match or category-based match' };
  console.log(`[CONFIDENCE] Result: ${finalResult.confidence} - ${finalResult.reason}`);
  return finalResult;
}

function checkForCrossCategoryMatch(ingredient: string, productName: string, productCategories?: string[]): boolean {
  const expectedCategory = guessCategory(ingredient);
  const ingredientLower = ingredient.toLowerCase();
  const productLower = productName.toLowerCase();
  const categories = productCategories || [];
  
  console.log(`[CROSS-CATEGORY CHECK] Ingredient: "${ingredient}" (expected: ${expectedCategory}) vs Product: "${productName}" (categories: [${categories.join(', ')}])`);
  
  // Known problematic patterns - using exact category names from categories.json
  const problematicPatterns = [
    // Bread vs Breaded/Battered items
    { 
      ingredient: 'bread', 
      productPattern: /breaded|battered|crusted/, 
      wrongCategories: ['Frozen Foods', 'Frozen Meals', 'Chicken', 'Beef', 'Fish & Seafood', 'Meat & Seafood'],
      description: 'bread ingredient matched breaded/battered food'
    },
    // Chicken vs Chicken-flavored items
    { 
      ingredient: 'chicken', 
      productPattern: /chicken.*(flavored|flavor|seasoning|ramen|soup|chips)/, 
      wrongCategories: ['Pantry Staples', 'Snacks', 'Chips', 'Beverages', 'Condiments & Sauces'],
      description: 'chicken ingredient matched chicken-flavored non-meat'
    },
    // Cheese vs Cheese-flavored snacks
    { 
      ingredient: 'cheese', 
      productPattern: /cheese.*(flavored|flavor|puffs|crackers|chips|snacks)/, 
      wrongCategories: ['Snacks', 'Chips', 'Crackers', 'Pantry Staples'],
      description: 'cheese ingredient matched cheese-flavored snack'
    },
    // Vanilla vs Vanilla-flavored non-baking items
    { 
      ingredient: 'vanilla', 
      productPattern: /vanilla.*(wafers|cookies|ice cream|yogurt)/, 
      wrongCategories: ['Snacks', 'Cookies', 'Ice Cream & Novelties', 'Yogurt'],
      description: 'vanilla extract matched vanilla-flavored food'
    }
  ];
  
  // Check against known problematic patterns
  for (const pattern of problematicPatterns) {
    if (ingredientLower.includes(pattern.ingredient) && pattern.productPattern.test(productLower)) {
      console.log(`[CROSS-CATEGORY CHECK] Pattern match: "${pattern.ingredient}" + pattern in "${productName}"`);
      
      // Check if product is in wrong category
      const hasWrongCategory = pattern.wrongCategories.some(wrongCat => 
        categories.some(cat => cat.toLowerCase().includes(wrongCat.toLowerCase()) || wrongCat.toLowerCase().includes(cat.toLowerCase()))
      );
      
      if (hasWrongCategory) {
        console.log(`[CROSS-CATEGORY CHECK] ❌ CROSS-CATEGORY MATCH DETECTED: ${pattern.description}`);
        return true;
      }
    }
  }
  
  // Additional heuristic: check category mismatch for simple ingredients
  if (expectedCategory && categories.length > 0) {
    console.log(`[CROSS-CATEGORY CHECK] Checking category alignment: expected "${expectedCategory}" vs product categories [${categories.join(', ')}]`);
    
    // Map categories to broader groups
    const categoryGroups: Record<string, string[]> = {
      'Breads': ['Bakery & Bread', 'Breads', 'Bagels & Muffins'],
      'Chicken': ['Meat & Seafood', 'Chicken', 'Bacon', 'Beef', 'Fish & Seafood'],
      'Cheese': ['Dairy', 'Cheese', 'Milk', 'Yogurt', 'Butter & Margarine'],
      'Fresh Vegetables': ['Produce', 'Fresh Vegetables', 'Fresh Fruit', 'Berries', 'Organic Produce'],
      'Bacon': ['Meat & Seafood', 'Bacon', 'Chicken', 'Beef', 'Fish & Seafood']
    };
    
    const expectedGroups = categoryGroups[expectedCategory] || [expectedCategory];
    const isExpectedCategory = categories.some(cat => 
      expectedGroups.some(expected => 
        cat.toLowerCase().includes(expected.toLowerCase()) || expected.toLowerCase().includes(cat.toLowerCase())
      )
    );
    
    console.log(`[CROSS-CATEGORY CHECK] Category alignment: ${isExpectedCategory ? '✅ ALIGNED' : '❌ MISALIGNED'}`);
    
    if (!isExpectedCategory) {
      // Simple ingredient name but complex product name from different category
      const ingredientWords = ingredientLower.split(' ').filter(w => w.length > 2);
      const productWords = productLower.split(' ').filter(w => w.length > 2);
      
      if (ingredientWords.length <= 2 && productWords.length >= 4) {
        console.log(`[CROSS-CATEGORY CHECK] ❌ COMPLEX PRODUCT MISMATCH: simple ingredient "${ingredient}" vs complex product "${productName}"`);
        return true;
      }
    }
  }
  
  console.log(`[CROSS-CATEGORY CHECK] ✅ No cross-category issues detected`);
  return false;
}

async function createBasket(supabase: any, userId: string, matches: ProductMatch[], summary: string): Promise<string> {
  // Create a new basket
  const { data: basketData, error: basketError } = await supabase
    .from('baskets')
    .insert({
      name: summary.length > 50 ? `${summary.substring(0, 50)}...` : summary,
      description: summary,
      is_public: false
    })
    .select()
    .single();

  if (basketError) {
    console.error('Error creating basket:', basketError);
    throw new Error('Failed to create basket');
  }

  // Add user as owner of the basket
  const { error: userError } = await supabase
    .from('basket_users')
    .insert({
      basket_id: basketData.id,
      user_id: userId,
      role: 'owner'
    });

  if (userError) {
    console.error('Error adding user to basket:', userError);
    throw new Error('Failed to add user to basket');
  }

  // Add products to the basket
  if (matches.length > 0) {
    // Deduplicate products to avoid violating UNIQUE(basket_id, product_id)
    const aggregated: Record<string, { quantity: number; notes: string | null }> = {};

    for (const match of matches) {
      if (!aggregated[match.product_id]) {
        aggregated[match.product_id] = {
          quantity: match.quantity,
          notes: match.unit ? `${match.quantity} ${match.unit} (${match.confidence} confidence: ${match.confidence_reason})` : `${match.confidence} confidence: ${match.confidence_reason}`,
        };
      } else {
        // If the product already exists, aggregate quantities
        aggregated[match.product_id].quantity += match.quantity;
      }
    }

    // Ensure quantities are positive integers to satisfy the INTEGER column type in the database
    const sanitizeQuantity = (qty: number | null | undefined): number => {
      if (!qty || !Number.isFinite(qty)) return 1;
      return Math.max(1, Math.round(qty));
    };

    const basketItems = Object.entries(aggregated).map(([product_id, info]) => ({
      basket_id: basketData.id,
      product_id,
      quantity: sanitizeQuantity(info.quantity),
      notes: info.notes,
    }));

    const { error: itemsError } = await supabase
      .from('basket_items')
      .insert(basketItems);

    if (itemsError) {
      console.error('Error adding items to basket:', itemsError);
      throw new Error('Failed to add items to basket');
    }
  }

  return basketData.id;
}