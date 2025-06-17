export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
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
            referencedRelation: "baskets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "basket_items_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
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
            referencedRelation: "baskets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "basket_trackings_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_basket_users_basket"
            columns: ["basket_id"]
            referencedRelation: "baskets"
            referencedColumns: ["id"]
          }
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
          path: string | null
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
          path?: string | null
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
          path?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      listings: {
        Row: {
          availability_status: string | null
          created_at: string | null
          currency: string | null
          id: string
          image_url: string | null
          in_stock: boolean | null
          last_checked: string | null
          location_id: string | null
          price: number | null
          product_id: string
          rating: number | null
          retailer_id: string
          retailer_specific_id: string | null
          review_count: number | null
          sale_price: number | null
          stock_quantity: number | null
          updated_at: string | null
          upc: string | null
          url: string
        }
        Insert: {
          availability_status?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          last_checked?: string | null
          location_id?: string | null
          price?: number | null
          product_id: string
          rating?: number | null
          retailer_id: string
          retailer_specific_id?: string | null
          review_count?: number | null
          sale_price?: number | null
          stock_quantity?: number | null
          updated_at?: string | null
          upc?: string | null
          url: string
        }
        Update: {
          availability_status?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          last_checked?: string | null
          location_id?: string | null
          price?: number | null
          product_id?: string
          rating?: number | null
          retailer_id?: string
          retailer_specific_id?: string | null
          review_count?: number | null
          sale_price?: number | null
          stock_quantity?: number | null
          updated_at?: string | null
          upc?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_location_id_fkey"
            columns: ["location_id"]
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_retailer_id_fkey"
            columns: ["retailer_id"]
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          }
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
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          }
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
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
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      price_histories: {
        Row: {
          currency: string | null
          id: string
          listing_id: string
          price: number
          timestamp: string | null
        }
        Insert: {
          currency?: string | null
          id?: string
          listing_id: string
          price: number
          timestamp?: string | null
        }
        Update: {
          currency?: string | null
          id?: string
          listing_id?: string
          price?: number
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_histories_listing_id_fkey"
            columns: ["listing_id"]
            referencedRelation: "listings"
            referencedColumns: ["id"]
          }
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
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
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
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_trackings_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
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
          updated_at: string | null
          upc: string | null
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
          updated_at?: string | null
          upc?: string | null
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
          updated_at?: string | null
          upc?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            referencedRelation: "brands"
            referencedColumns: ["id"]
          }
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
          start_date: string
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
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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