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
  quantity: number;
  unit: string | null;
}

interface ChatToBasketResponse {
  basket_id: string;
  matches: ProductMatch[];
  unmatched: string[];
  summary: string;
}

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
    
    // Match ingredients to products
    const { matches, unmatched } = await matchIngredientsToProducts(supabase, parsedData.ingredients);
    
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
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that extracts food ingredients from user messages. Extract all ingredients mentioned, with quantities and units when available."
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

async function matchIngredientsToProducts(supabase: any, ingredients: Ingredient[]): Promise<{ matches: ProductMatch[], unmatched: string[] }> {
  const matches: ProductMatch[] = [];
  const unmatched: string[] = [];

  for (const ingredient of ingredients) {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug
      `)
      .textSearch('name', ingredient.name, { 
        type: 'websearch',
        config: 'english' 
      })
      .limit(1);

    if (error) {
      console.error('Error searching for products:', error);
      unmatched.push(ingredient.name);
      continue;
    }

    if (data && data.length > 0) {
      const product = data[0];
      
      // Determine confidence level
      let confidence: 'high' | 'medium' | 'low' = 'low';
      const productNameLower = product.name.toLowerCase();
      const ingredientNameLower = ingredient.name.toLowerCase();
      
      if (productNameLower === ingredientNameLower) {
        confidence = 'high';
      } else if (productNameLower.includes(ingredientNameLower) || ingredientNameLower.includes(productNameLower)) {
        confidence = 'medium';
      }

      matches.push({
        ingredient: ingredient.name,
        product_id: product.id,
        product_name: product.name,
        confidence,
        quantity: ingredient.quantity || 1,
        unit: ingredient.unit
      });
    } else {
      unmatched.push(ingredient.name);
    }
  }

  return { matches, unmatched };
}

async function createBasket(supabase: any, userId: string, matches: ProductMatch[], summary: string): Promise<string> {
  // Create a new basket
  const { data: basketData, error: basketError } = await supabase
    .from('baskets')
    .insert({
      name: `Chat Basket: ${summary.substring(0, 30)}${summary.length > 30 ? '...' : ''}`,
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
    const basketItems = matches.map(match => ({
      basket_id: basketData.id,
      product_id: match.product_id,
      quantity: match.quantity,
      notes: match.unit ? `${match.quantity} ${match.unit}` : null
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