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
    const { data, error } = await this.supabase
      .from('products')
      .select(`
        id,
        name,
        slug
      `)
      .textSearch('name', searchTerm, { 
        type: 'websearch',
        config: 'english' 
      })
      .limit(limit);

    if (error) throw error;
    return data || [];
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
            name
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
      return this.searchProductsByName(searchTerm, limit);
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
      
      Try multiple search strategies:
      1. Exact name search
      2. Category-based search if exact fails
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
          alternatives.push(...result.slice(0, 3)); // Keep top 3 alternatives
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
      const { confidence, reason } = determineConfidence(ingredient.name, bestMatch.name);
      
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
            .slice(0, 2)
            .map(alt => ({
              product_id: alt.id,
              product_name: alt.name,
              confidence: determineConfidence(ingredient.name, alt.name).confidence
            }))
        }
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
  
  for (const [category, items] of Object.entries(INGREDIENT_CATEGORIES)) {
    if (items.some(item => lowerIngredient.includes(item.toLowerCase()) || item.toLowerCase().includes(lowerIngredient))) {
      return category;
    }
  }
  
  return null;
}

function determineConfidence(ingredient: string, productName: string): { confidence: 'high' | 'medium' | 'low', reason: string } {
  const ingredientLower = ingredient.toLowerCase();
  const productLower = productName.toLowerCase();
  
  // Exact match
  if (ingredientLower === productLower) {
    return { confidence: 'high', reason: 'Exact name match' };
  }
  
  // Product name contains ingredient
  if (productLower.includes(ingredientLower)) {
    return { confidence: 'high', reason: 'Product name contains ingredient' };
  }
  
  // Ingredient contains product name (less common but possible)
  if (ingredientLower.includes(productLower)) {
    return { confidence: 'medium', reason: 'Ingredient contains product name' };
  }
  
  // Check for synonyms
  const synonyms = getSynonyms(ingredient);
  for (const synonym of synonyms) {
    if (productLower.includes(synonym.toLowerCase()) || synonym.toLowerCase().includes(productLower)) {
      return { confidence: 'medium', reason: `Synonym match: ${synonym}` };
    }
  }
  
  // Partial word match
  const ingredientWords = ingredientLower.split(' ');
  const productWords = productLower.split(' ');
  const commonWords = ingredientWords.filter(word => 
    productWords.some(pWord => pWord.includes(word) || word.includes(pWord))
  );
  
  if (commonWords.length > 0) {
    return { confidence: 'medium', reason: `Partial match: ${commonWords.join(', ')}` };
  }
  
  return { confidence: 'low', reason: 'Fuzzy match or category-based match' };
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

    const basketItems = Object.entries(aggregated).map(([product_id, info]) => ({
      basket_id: basketData.id,
      product_id,
      quantity: info.quantity,
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