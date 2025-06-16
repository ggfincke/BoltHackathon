export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      basket_items: {
        Row: {
          added_at: string | null
          basket_id: string
          id: string
          notes: string | null
          price_at_add: number | null
          product_id: string
          quantity: number | null
          updated_at: string | null
        }
        Insert: {
          added_at?: string | null
          basket_id: string
          id?: string
          notes?: string | null
          price_at_add?: number | null
          product_id: string
          quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          added_at?: string | null
          basket_id?: string
          id?: string
          notes?: string | null
          price_at_add?: number | null
          product_id?: string
          quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "basket_items_basket_id_fkey"
            columns: ["basket_id"]
            isOneToOne: false
            referencedRelation: "baskets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "basket_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      basket_trackings: {
        Row: {
          basket_id: string
          created_at: string | null
          id: string
          notify_on_availability: boolean | null
          notify_on_changes: boolean | null
          notify_on_price_drop: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          basket_id: string
          created_at?: string | null
          id?: string
          notify_on_availability?: boolean | null
          notify_on_changes?: boolean | null
          notify_on_price_drop?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          basket_id?: string
          created_at?: string | null
          id?: string
          notify_on_availability?: boolean | null
          notify_on_changes?: boolean | null
          notify_on_price_drop?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "basket_trackings_basket_id_fkey"
            columns: ["basket_id"]
            isOneToOne: false
            referencedRelation: "baskets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "basket_trackings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      basket_users: {
        Row: {
          basket_id: string | null
          created_at: string | null
          id: string
          role: string | null
          user_id: string
        }
        Insert: {
          basket_id?: string | null
          created_at?: string | null
          id?: string
          role?: string | null
          user_id: string
        }
        Update: {
          basket_id?: string | null
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "basket_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_basket_users_basket"
            columns: ["basket_id"]
            isOneToOne: false
            referencedRelation: "baskets"
            referencedColumns: ["id"]
          },
        ]
      }
      baskets: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          slug: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_upc_lookups: {
        Row: {
          assigned_to: string | null
          confidence_override: number | null
          created_at: string | null
          failure_reason: string | null
          id: string
          last_error: string | null
          manual_upc: string | null
          normalized_name: string
          notes: string | null
          original_url: string | null
          product_name: string
          resolved_at: string | null
          retailer_source: string | null
          retry_count: number | null
          services_tried: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          confidence_override?: number | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          last_error?: string | null
          manual_upc?: string | null
          normalized_name: string
          notes?: string | null
          original_url?: string | null
          product_name: string
          resolved_at?: string | null
          retailer_source?: string | null
          retry_count?: number | null
          services_tried?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          confidence_override?: number | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          last_error?: string | null
          manual_upc?: string | null
          normalized_name?: string
          notes?: string | null
          original_url?: string | null
          product_name?: string
          resolved_at?: string | null
          retailer_source?: string | null
          retry_count?: number | null
          services_tried?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "failed_upc_lookups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          created_at: string | null
          currency: string | null
          id: string
          in_stock: boolean | null
          last_checked: string | null
          location_id: string | null
          price: number | null
          product_id: string
          retailer_id: string
          retailer_specific_id: string | null
          sale_price: number | null
          stock_quantity: number | null
          upc: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          id?: string
          in_stock?: boolean | null
          last_checked?: string | null
          location_id?: string | null
          price?: number | null
          product_id: string
          retailer_id: string
          retailer_specific_id?: string | null
          sale_price?: number | null
          stock_quantity?: number | null
          upc?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          id?: string
          in_stock?: boolean | null
          last_checked?: string | null
          location_id?: string | null
          price?: number | null
          product_id?: string
          retailer_id?: string
          retailer_specific_id?: string | null
          sale_price?: number | null
          stock_quantity?: number | null
          upc?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          opening_hours: Json | null
          phone: string | null
          postal_code: string | null
          retailer_id: string
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          opening_hours?: Json | null
          phone?: string | null
          postal_code?: string | null
          retailer_id: string
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          postal_code?: string | null
          retailer_id?: string
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string | null
          id: string
          is_enabled: boolean | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          notification_type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          listing_id: string | null
          message: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          listing_id?: string | null
          message: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          listing_id?: string | null
          message?: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_notifications_listing"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      price_histories: {
        Row: {
          currency: string | null
          id: string
          is_on_sale: boolean | null
          listing_id: string
          price: number
          sale_price: number | null
          timestamp: string | null
        }
        Insert: {
          currency?: string | null
          id?: string
          is_on_sale?: boolean | null
          listing_id: string
          price: number
          sale_price?: number | null
          timestamp?: string | null
        }
        Update: {
          currency?: string | null
          id?: string
          is_on_sale?: boolean | null
          listing_id?: string
          price?: number
          sale_price?: number | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_histories_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_trackings: {
        Row: {
          created_at: string | null
          id: string
          notify_on_availability: boolean | null
          notify_on_changes: boolean | null
          notify_on_price_drop: boolean | null
          product_id: string
          target_price: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notify_on_availability?: boolean | null
          notify_on_changes?: boolean | null
          notify_on_price_drop?: boolean | null
          product_id: string
          target_price?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notify_on_availability?: boolean | null
          notify_on_changes?: boolean | null
          notify_on_price_drop?: boolean | null
          product_id?: string
          target_price?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_trackings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_trackings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          created_at: string | null
          description: string | null
          dimensions: Json | null
          id: string
          is_active: boolean | null
          name: string
          review_count: number | null
          review_score: number | null
          slug: string
          upc: string | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          description?: string | null
          dimensions?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          review_count?: number | null
          review_score?: number | null
          slug: string
          upc?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          description?: string | null
          dimensions?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          review_count?: number | null
          review_score?: number | null
          slug?: string
          upc?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      retailer_metrics: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      retailers: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          slug: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          duration_days: number
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_days: number
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_days?: number
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          auto_renew: boolean | null
          created_at: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          payment_id: string | null
          plan_id: string
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_renew?: boolean | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          payment_id?: string | null
          plan_id: string
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_renew?: boolean | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          payment_id?: string | null
          plan_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          date_joined: string | null
          email: string
          first_name: string | null
          groups: Json | null
          id: string
          is_active: boolean | null
          is_staff: boolean | null
          last_name: string | null
          updated_at: string | null
          user_permissions: Json | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          date_joined?: string | null
          email: string
          first_name?: string | null
          groups?: Json | null
          id: string
          is_active?: boolean | null
          is_staff?: boolean | null
          last_name?: string | null
          updated_at?: string | null
          user_permissions?: Json | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          date_joined?: string | null
          email?: string
          first_name?: string | null
          groups?: Json | null
          id?: string
          is_active?: boolean | null
          is_staff?: boolean | null
          last_name?: string | null
          updated_at?: string | null
          user_permissions?: Json | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      notification_channel: "email" | "push" | "sms"
      notification_type: "price_drop" | "availability" | "changes" | "general"
      subscription_status: "active" | "inactive" | "cancelled" | "expired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      notification_channel: ["email", "push", "sms"],
      notification_type: ["price_drop", "availability", "changes", "general"],
      subscription_status: ["active", "inactive", "cancelled", "expired"],
    },
  },
} as const

