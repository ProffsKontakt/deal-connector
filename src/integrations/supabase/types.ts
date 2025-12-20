export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      closer_commission_types: {
        Row: {
          closer_id: string
          commission_amount: number
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          closer_id: string
          commission_amount?: number
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          closer_id?: string
          commission_amount?: number
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "closer_commission_types_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      closer_regions: {
        Row: {
          closer_id: string
          created_at: string
          id: string
          organization_id: string
          region_id: string
        }
        Insert: {
          closer_id: string
          created_at?: string
          id?: string
          organization_id: string
          region_id: string
        }
        Update: {
          closer_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          region_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closer_regions_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closer_regions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closer_regions_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_organizations: {
        Row: {
          contact_id: string
          id: string
          organization_id: string
        }
        Insert: {
          contact_id: string
          id?: string
          organization_id: string
        }
        Update: {
          contact_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_organizations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          created_at: string
          date_sent: string
          email: string
          id: string
          interest: Database["public"]["Enums"]["interest_type"]
          name: string | null
          opener_id: string
          phone: string | null
          postal_code: string | null
          region_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          date_sent?: string
          email: string
          id?: string
          interest: Database["public"]["Enums"]["interest_type"]
          name?: string | null
          opener_id: string
          phone?: string | null
          postal_code?: string | null
          region_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          date_sent?: string
          email?: string
          id?: string
          interest?: Database["public"]["Enums"]["interest_type"]
          name?: string | null
          opener_id?: string
          phone?: string | null
          postal_code?: string | null
          region_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_opener_id_fkey"
            columns: ["opener_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_requests: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          organization_id: string
          reason: string | null
          requested_by: string
          status: Database["public"]["Enums"]["credit_status"]
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          organization_id: string
          reason?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["credit_status"]
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          reason?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["credit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_cost_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          percentage: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          percentage?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      organization_commission_settings: {
        Row: {
          base_cost: number
          created_at: string
          eur_to_sek_rate: number
          id: string
          lf_finans_percent: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          base_cost?: number
          created_at?: string
          eur_to_sek_rate?: number
          id?: string
          lf_finans_percent?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          base_cost?: number
          created_at?: string
          eur_to_sek_rate?: number
          id?: string
          lf_finans_percent?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_commission_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_person_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          price_per_battery_deal: number | null
          price_per_site_visit: number | null
          price_per_solar_deal: number | null
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
        }
        Insert: {
          contact_person_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          price_per_battery_deal?: number | null
          price_per_site_visit?: number | null
          price_per_solar_deal?: number | null
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Update: {
          contact_person_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          price_per_battery_deal?: number | null
          price_per_site_visit?: number | null
          price_per_solar_deal?: number | null
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          base_price_incl_moms: number
          capacity_kwh: number | null
          created_at: string
          green_tech_deduction_percent: number
          id: string
          material_cost_eur: number
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          base_price_incl_moms: number
          capacity_kwh?: number | null
          created_at?: string
          green_tech_deduction_percent?: number
          id?: string
          material_cost_eur: number
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          base_price_incl_moms?: number
          capacity_kwh?: number | null
          created_at?: string
          green_tech_deduction_percent?: number
          id?: string
          material_cost_eur?: number
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          closer_base_commission: number | null
          closer_company_markup_share: number | null
          closer_markup_percentage: number | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          opener_commission_per_deal: number | null
          opener_commission_per_lead: number | null
          organization_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          closer_base_commission?: number | null
          closer_company_markup_share?: number | null
          closer_markup_percentage?: number | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          opener_commission_per_deal?: number | null
          opener_commission_per_lead?: number | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          closer_base_commission?: number | null
          closer_company_markup_share?: number | null
          closer_markup_percentage?: number | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          opener_commission_per_deal?: number | null
          opener_commission_per_lead?: number | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          created_at: string
          id: string
          name: string
          postal_prefixes: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          postal_prefixes?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          postal_prefixes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          closed_at: string | null
          closer_commission: number | null
          closer_id: string
          closer_notes: string | null
          contact_id: string
          created_at: string
          discount_amount: number | null
          full_green_deduction: boolean | null
          id: string
          invoiceable_amount: number | null
          num_property_owners: number | null
          offer_details: string | null
          opener_commission: number | null
          organization_id: string
          partner_notes: string | null
          pipeline_status: string
          price_to_customer_incl_moms: number | null
          product_id: string | null
          total_order_value: number | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closer_commission?: number | null
          closer_id: string
          closer_notes?: string | null
          contact_id: string
          created_at?: string
          discount_amount?: number | null
          full_green_deduction?: boolean | null
          id?: string
          invoiceable_amount?: number | null
          num_property_owners?: number | null
          offer_details?: string | null
          opener_commission?: number | null
          organization_id: string
          partner_notes?: string | null
          pipeline_status?: string
          price_to_customer_incl_moms?: number | null
          product_id?: string | null
          total_order_value?: number | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closer_commission?: number | null
          closer_id?: string
          closer_notes?: string | null
          contact_id?: string
          created_at?: string
          discount_amount?: number | null
          full_green_deduction?: boolean | null
          id?: string
          invoiceable_amount?: number | null
          num_property_owners?: number | null
          offer_details?: string | null
          opener_commission?: number | null
          organization_id?: string
          partner_notes?: string | null
          pipeline_status?: string
          price_to_customer_incl_moms?: number | null
          product_id?: string | null
          total_order_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_region_by_postal_code: { Args: { postal: string }; Returns: string }
      get_user_organization: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      credit_status: "pending" | "approved" | "denied"
      interest_type: "sun" | "battery" | "sun_battery"
      organization_status: "active" | "archived"
      user_role: "admin" | "teamleader" | "opener" | "organization" | "closer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      credit_status: ["pending", "approved", "denied"],
      interest_type: ["sun", "battery", "sun_battery"],
      organization_status: ["active", "archived"],
      user_role: ["admin", "teamleader", "opener", "organization", "closer"],
    },
  },
} as const
