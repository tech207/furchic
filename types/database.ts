export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// NOTE: This file is a hand-written placeholder until `supabase gen types typescript` is run.
// Only the tables actively used in API routes are typed here.

export type Database = {
  public: {
    Tables: {
      admin_roles: {
        Row: {
          id: string
          name: string
          display_name: string
          description: string | null
          permissions: string[]
          is_system: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          display_name: string
          description?: string | null
          permissions?: string[]
          is_system?: boolean
          created_at?: string
        }
        Update: {
          display_name?: string
          description?: string | null
          permissions?: string[]
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string | null
          gender: 'male' | 'female' | 'other' | null
          birthday: string | null
          auth_provider: string | null
          avatar_url: string | null
          role: 'user' | 'admin'
          member_level_id: string | null
          reward_points: number
          total_spent: number
          // S08-A admin columns
          admin_role_id: string | null
          is_active_admin: boolean
          invited_at: string | null
          invited_by: string | null
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          phone?: string | null
          email?: string | null
          gender?: 'male' | 'female' | 'other' | null
          birthday?: string | null
          auth_provider?: string | null
          avatar_url?: string | null
          role?: 'user' | 'admin'
          member_level_id?: string | null
          reward_points?: number
          total_spent?: number
          // S08-A admin columns
          admin_role_id?: string | null
          is_active_admin?: boolean
          invited_at?: string | null
          invited_by?: string | null
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          email?: string | null
          gender?: 'male' | 'female' | 'other' | null
          birthday?: string | null
          auth_provider?: string | null
          avatar_url?: string | null
          role?: 'user' | 'admin'
          member_level_id?: string | null
          reward_points?: number
          total_spent?: number
          // S08-A admin columns
          admin_role_id?: string | null
          is_active_admin?: boolean
          invited_at?: string | null
          invited_by?: string | null
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'users_admin_role_id_fkey'
            columns: ['admin_role_id']
            referencedRelation: 'admin_roles'
            referencedColumns: ['id']
          },
        ]
      }
      member_levels: {
        Row: {
          id: string
          name: string
          min_spent: number
          reward_rate: number
          discount_rate: number
          benefits: Json
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          min_spent?: number
          reward_rate?: number
          discount_rate?: number
          benefits?: Json
          sort_order?: number
          created_at?: string
        }
        Update: {
          name?: string
          min_spent?: number
          reward_rate?: number
          discount_rate?: number
          benefits?: Json
          sort_order?: number
        }
        Relationships: []
      }
      pets: {
        Row: {
          id: string
          user_id: string
          name: string
          breed: string | null
          gender: string | null
          birthday: string | null
          is_neutered: boolean
          chip_id: string | null
          photo_url: string | null
          ai_photo_url: string | null
          public_fields: Json
          card_status: 'none' | 'pending' | 'active' | 'disabled'
          vet_hospital: string
          special_care: boolean
          special_care_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          breed?: string | null
          gender?: string | null
          birthday?: string | null
          is_neutered?: boolean
          chip_id?: string | null
          photo_url?: string | null
          ai_photo_url?: string | null
          public_fields?: Json
          card_status?: 'none' | 'pending' | 'active' | 'disabled'
          vet_hospital: string
          special_care?: boolean
          special_care_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          breed?: string | null
          gender?: string | null
          birthday?: string | null
          is_neutered?: boolean
          chip_id?: string | null
          photo_url?: string | null
          ai_photo_url?: string | null
          public_fields?: Json
          card_status?: 'none' | 'pending' | 'active' | 'disabled'
          vet_hospital?: string
          special_care?: boolean
          special_care_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pets_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      pet_caregivers: {
        Row: {
          id: string
          pet_id: string
          user_id: string
          role: 'owner' | 'caregiver'
          display_name: string | null
          contact_methods: Json
          is_visible: boolean
          sort_order: number
          invited_at: string | null
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          pet_id: string
          user_id: string
          role: 'owner' | 'caregiver'
          display_name?: string | null
          contact_methods?: Json
          is_visible?: boolean
          sort_order?: number
          invited_at?: string | null
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          role?: 'owner' | 'caregiver'
          display_name?: string | null
          contact_methods?: Json
          is_visible?: boolean
          sort_order?: number
          invited_at?: string | null
          accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'pet_caregivers_pet_id_fkey'
            columns: ['pet_id']
            referencedRelation: 'pets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pet_caregivers_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      nfc_cards: {
        Row: {
          id: string
          pet_id: string | null
          qr_url: string | null
          status: 'unbound' | 'active'
          bound_at: string | null
          bound_by: string | null
          card_serial: string | null
        }
        Insert: {
          id: string
          pet_id?: string | null
          qr_url?: string | null
          status?: 'unbound' | 'active'
          bound_at?: string | null
          bound_by?: string | null
          card_serial?: string | null
        }
        Update: {
          pet_id?: string | null
          qr_url?: string | null
          status?: 'unbound' | 'active'
          bound_at?: string | null
          bound_by?: string | null
          card_serial?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'nfc_cards_pet_id_fkey'
            columns: ['pet_id']
            referencedRelation: 'pets'
            referencedColumns: ['id']
          },
        ]
      }
      pet_caregiver_invitations: {
        Row: {
          id: string
          pet_id: string
          inviter_id: string
          token: string
          status: 'pending' | 'accepted' | 'expired'
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          pet_id: string
          inviter_id: string
          token: string
          status?: 'pending' | 'accepted' | 'expired'
          expires_at: string
          created_at?: string
        }
        Update: {
          status?: 'pending' | 'accepted' | 'expired'
          expires_at?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          id: string
          type: 'hero' | 'sponsor' | 'shop'
          title: string | null
          subtitle: string | null
          image_url: string | null
          mobile_image_url: string | null
          alt_text: string | null
          link_url: string | null
          bg_class: string | null
          is_active: boolean
          status: 'draft' | 'published' | 'archived'
          starts_at: string | null
          ends_at: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          type: 'hero' | 'sponsor' | 'shop'
          title?: string | null
          subtitle?: string | null
          image_url?: string | null
          mobile_image_url?: string | null
          alt_text?: string | null
          link_url?: string | null
          bg_class?: string | null
          is_active?: boolean
          status?: 'draft' | 'published' | 'archived'
          starts_at?: string | null
          ends_at?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          type?: 'hero' | 'sponsor' | 'shop'
          title?: string | null
          subtitle?: string | null
          image_url?: string | null
          mobile_image_url?: string | null
          alt_text?: string | null
          link_url?: string | null
          bg_class?: string | null
          is_active?: boolean
          status?: 'draft' | 'published' | 'archived'
          starts_at?: string | null
          ends_at?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      coupons: {
        Row: {
          id: string
          code: string
          name: string
          type: 'fixed' | 'percent'
          value: number
          min_amount: number
          max_discount: number | null
          is_active: boolean
          starts_at: string | null
          expires_at: string | null
          max_uses: number | null
          used_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          type: 'fixed' | 'percent'
          value: number
          min_amount?: number
          max_discount?: number | null
          is_active?: boolean
          starts_at?: string | null
          expires_at?: string | null
          max_uses?: number | null
          used_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          type?: 'fixed' | 'percent'
          value?: number
          min_amount?: number
          max_discount?: number | null
          is_active?: boolean
          starts_at?: string | null
          expires_at?: string | null
          max_uses?: number | null
          used_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      coupon_usages: {
        Row: {
          id: string
          coupon_id: string
          user_id: string
          order_id: string | null
          discount_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          coupon_id: string
          user_id: string
          order_id?: string | null
          discount_amount: number
          created_at?: string
        }
        Update: {
          order_id?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          id: string
          name: string
          description: string | null
          discount_type: 'fixed' | 'percent' | 'free_shipping'
          discount_value: number
          condition_type: 'amount' | 'quantity' | 'member_level'
          condition_value: number
          condition_level_id: string | null
          is_stackable: boolean
          is_active: boolean
          starts_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          discount_type: 'fixed' | 'percent' | 'free_shipping'
          discount_value: number
          condition_type: 'amount' | 'quantity' | 'member_level'
          condition_value?: number
          condition_level_id?: string | null
          is_stackable?: boolean
          is_active?: boolean
          starts_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          discount_type?: 'fixed' | 'percent' | 'free_shipping'
          discount_value?: number
          condition_type?: 'amount' | 'quantity' | 'member_level'
          condition_value?: number
          condition_level_id?: string | null
          is_stackable?: boolean
          is_active?: boolean
          starts_at?: string | null
          expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      carts: {
        Row: {
          id: string
          user_id: string
          variant_id: string
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          variant_id: string
          quantity: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'carts_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'carts_variant_id_fkey'
            columns: ['variant_id']
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          value: Json
          description: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          value: Json
          description?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          value?: Json
          description?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      redemption_codes: {
        Row: {
          id: string
          code: string
          batch_name: string | null
          used_by: string | null
          used_at: string | null
          expires_at: string | null
          used_count: number
          max_uses: number
          created_at: string
        }
        Insert: {
          id?: string
          batch_name?: string | null
          code: string
          used_by?: string | null
          used_at?: string | null
          expires_at?: string | null
          used_count?: number
          max_uses?: number
          created_at?: string
        }
        Update: {
          used_by?: string | null
          used_at?: string | null
          expires_at?: string | null
          used_count?: number
          max_uses?: number
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          id: string
          event_type: string
          page_url: string
          properties: Json | null
          ip_hash: string | null
          session_id: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          page_url?: string
          properties?: Json | null
          ip_hash?: string | null
          session_id?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      reward_transactions: {
        Row: {
          id: string
          user_id: string
          type: 'earned' | 'spent' | 'adjusted' | 'expired'
          points: number
          note: string | null
          order_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'earned' | 'spent' | 'adjusted' | 'expired'
          points: number
          note?: string | null
          order_id?: string | null
          created_at?: string
        }
        Update: {
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'reward_transactions_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      payment_transactions: {
        Row: {
          id: string
          order_id: string
          ecpay_trade_no: string | null
          payment_type: string | null
          amount: number
          status: 'paid' | 'pending' | 'refunded' | 'failed'
          paid_at: string | null
          ecpay_response: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          ecpay_trade_no?: string | null
          payment_type?: string | null
          amount: number
          status?: 'paid' | 'pending' | 'refunded' | 'failed'
          paid_at?: string | null
          ecpay_response?: Json | null
          created_at?: string
        }
        Update: {
          status?: 'paid' | 'pending' | 'refunded' | 'failed'
          paid_at?: string | null
          ecpay_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'payment_transactions_order_id_fkey'
            columns: ['order_id']
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
        ]
      }
      order_audit_logs: {
        Row: {
          id: string
          order_id: string
          admin_id: string | null
          action: string
          old_status: string | null
          new_status: string | null
          note: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          admin_id?: string | null
          action: string
          old_status?: string | null
          new_status?: string | null
          note?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: [
          {
            foreignKeyName: 'order_audit_logs_order_id_fkey'
            columns: ['order_id']
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
        ]
      }
      orders: {
        Row: {
          id: string
          user_id: string
          status:
            | 'pending'
            | 'paid'
            | 'processing'
            | 'shipped'
            | 'done'
            | 'cancelled'
            | 'refunded'
          total_amount: number
          subtotal: number
          shipping_fee: number
          promotions_discount: number
          coupon_discount: number
          reward_points_discount: number
          coupon_code: string | null
          ecpay_order_id: string | null
          tracking_number: string | null
          logistics_company: string | null
          admin_note: string | null
          recipient_name: string | null
          recipient_phone: string | null
          recipient_address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?:
            | 'pending'
            | 'paid'
            | 'processing'
            | 'shipped'
            | 'done'
            | 'cancelled'
            | 'refunded'
          total_amount?: number
          subtotal?: number
          shipping_fee?: number
          promotions_discount?: number
          coupon_discount?: number
          reward_points_discount?: number
          coupon_code?: string | null
          ecpay_order_id?: string | null
          tracking_number?: string | null
          logistics_company?: string | null
          admin_note?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?:
            | 'pending'
            | 'paid'
            | 'processing'
            | 'shipped'
            | 'done'
            | 'cancelled'
            | 'refunded'
          total_amount?: number
          subtotal?: number
          shipping_fee?: number
          promotions_discount?: number
          coupon_discount?: number
          reward_points_discount?: number
          coupon_code?: string | null
          ecpay_order_id?: string | null
          tracking_number?: string | null
          logistics_company?: string | null
          admin_note?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_address?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'orders_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      card_print_requests: {
        Row: {
          id: string
          user_id: string
          pet_id: string
          source: 'onsite' | 'online'
          status: 'pending' | 'printing' | 'done'
          redemption_code_id: string | null
          order_id: string | null
          card_front_url: string | null
          card_back_url: string | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          pet_id: string
          source: 'onsite' | 'online'
          status?: 'pending' | 'printing' | 'done'
          redemption_code_id?: string | null
          order_id?: string | null
          card_front_url?: string | null
          card_back_url?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          source?: 'onsite' | 'online'
          status?: 'pending' | 'printing' | 'done'
          card_front_url?: string | null
          card_back_url?: string | null
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'card_print_requests_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'card_print_requests_pet_id_fkey'
            columns: ['pet_id']
            referencedRelation: 'pets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'card_print_requests_redemption_code_id_fkey'
            columns: ['redemption_code_id']
            referencedRelation: 'redemption_codes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'card_print_requests_order_id_fkey'
            columns: ['order_id']
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          base_price: number
          images: Json
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          base_price?: number
          images?: Json
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          base_price?: number
          images?: Json
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          name: string
          sku: string
          price: number | null
          stock: number
          low_stock_threshold: number
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          name: string
          sku: string
          price?: number | null
          stock?: number
          low_stock_threshold?: number
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          sku?: string
          price?: number | null
          stock?: number
          low_stock_threshold?: number
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      product_variant_options: {
        Row: {
          id: string
          variant_id: string
          option_name: string
          option_value: string
        }
        Insert: {
          id?: string
          variant_id: string
          option_name: string
          option_value: string
        }
        Update: {
          option_name?: string
          option_value?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_variant_options_variant_id_fkey'
            columns: ['variant_id']
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
        ]
      }
      stock_logs: {
        Row: {
          id: string
          variant_id: string
          change: number
          stock_after: number
          reason: 'manual' | 'order' | 'return' | 'adjustment'
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          variant_id: string
          change: number
          stock_after: number
          reason: 'manual' | 'order' | 'return' | 'adjustment'
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'stock_logs_variant_id_fkey'
            columns: ['variant_id']
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          variant_id: string
          product_id: string
          product_name: string
          variant_name: string
          sku: string
          quantity: number
          unit_price: number
          subtotal: number
        }
        Insert: {
          id?: string
          order_id: string
          variant_id: string
          product_id: string
          product_name: string
          variant_name: string
          sku: string
          quantity: number
          unit_price: number
          subtotal: number
        }
        Update: {
          quantity?: number
          unit_price?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['order_id']
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey'
            columns: ['variant_id']
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_product_id_fkey'
            columns: ['product_id']
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      faqs: {
        Row: {
          id: string
          question: string
          answer: string
          category: 'general' | 'membership' | 'nfc' | 'shipping' | 'payment'
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question: string
          answer: string
          category?: 'general' | 'membership' | 'nfc' | 'shipping' | 'payment'
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          question?: string
          answer?: string
          category?: 'general' | 'membership' | 'nfc' | 'shipping' | 'payment'
          sort_order?: number
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          id: string
          name: string
          description: string | null
          logo_url: string | null
          website_url: string | null
          category: 'brand' | 'store' | 'enterprise'
          is_marquee: boolean
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          logo_url?: string | null
          website_url?: string | null
          category?: 'brand' | 'store' | 'enterprise'
          is_marquee?: boolean
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          logo_url?: string | null
          website_url?: string | null
          category?: 'brand' | 'store' | 'enterprise'
          is_marquee?: boolean
          sort_order?: number
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      contact_settings: {
        Row: {
          id: number
          email: string | null
          line_url: string | null
          form_title: string
          form_description: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          email?: string | null
          line_url?: string | null
          form_title?: string
          form_description?: string | null
          updated_at?: string
        }
        Update: {
          email?: string | null
          line_url?: string | null
          form_title?: string
          form_description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type FaqCategory =
  Database['public']['Tables']['faqs']['Row']['category']
export type Faq = Database['public']['Tables']['faqs']['Row']
export type PartnerCategory =
  Database['public']['Tables']['partners']['Row']['category']
export type Partner = Database['public']['Tables']['partners']['Row']
export type ContactSettings =
  Database['public']['Tables']['contact_settings']['Row']
