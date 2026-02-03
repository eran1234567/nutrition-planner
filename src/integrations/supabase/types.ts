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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      favorites: {
        Row: {
          created_at: string | null
          id: string
          profile_id: string
          recipe_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_id: string
          recipe_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_list_items: {
        Row: {
          aisle: string | null
          created_at: string | null
          id: string
          ingredient_name: string
          is_checked: boolean | null
          is_pantry_staple: boolean | null
          meal_plan_id: string
          quantity: number | null
          unit: string | null
        }
        Insert: {
          aisle?: string | null
          created_at?: string | null
          id?: string
          ingredient_name: string
          is_checked?: boolean | null
          is_pantry_staple?: boolean | null
          meal_plan_id: string
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          aisle?: string | null
          created_at?: string | null
          id?: string
          ingredient_name?: string
          is_checked?: boolean | null
          is_pantry_staple?: boolean | null
          meal_plan_id?: string
          quantity?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grocery_list_items_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          age: number | null
          avatar_url: string | null
          created_at: string | null
          household_id: string
          id: string
          is_child: boolean | null
          member_name: string
          role: Database["public"]["Enums"]["member_role"] | null
          user_id: string | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string | null
          household_id: string
          id?: string
          is_child?: boolean | null
          member_name: string
          role?: Database["public"]["Enums"]["member_role"] | null
          user_id?: string | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string | null
          household_id?: string
          id?: string
          is_child?: boolean | null
          member_name?: string
          role?: Database["public"]["Enums"]["member_role"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string | null
          id: string
          locale: string | null
          name: string
          owner_user_id: string
          units_default: Database["public"]["Enums"]["unit_system"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          locale?: string | null
          name: string
          owner_user_id: string
          units_default?: Database["public"]["Enums"]["unit_system"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          locale?: string | null
          name?: string
          owner_user_id?: string
          units_default?: Database["public"]["Enums"]["unit_system"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ingredient_nutrition: {
        Row: {
          brand: string | null
          calories: number
          carbs_g: number
          cholesterol_mg: number
          created_at: string
          fat_g: number
          fiber_g: number
          id: string
          keywords: string[]
          name: string
          protein_g: number
          saturated_fat_g: number
          serving_description: string
          sodium_mg: number
          sugar_g: number
        }
        Insert: {
          brand?: string | null
          calories?: number
          carbs_g?: number
          cholesterol_mg?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          id?: string
          keywords?: string[]
          name: string
          protein_g?: number
          saturated_fat_g?: number
          serving_description?: string
          sodium_mg?: number
          sugar_g?: number
        }
        Update: {
          brand?: string | null
          calories?: number
          carbs_g?: number
          cholesterol_mg?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          id?: string
          keywords?: string[]
          name?: string
          protein_g?: number
          saturated_fat_g?: number
          serving_description?: string
          sodium_mg?: number
          sugar_g?: number
        }
        Relationships: []
      }
      meal_plan_days: {
        Row: {
          day_date: string
          day_index: number
          id: string
          meal_plan_id: string
        }
        Insert: {
          day_date: string
          day_index: number
          id?: string
          meal_plan_id: string
        }
        Update: {
          day_date?: string
          day_index?: number
          id?: string
          meal_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_days_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_meals: {
        Row: {
          id: string
          is_leftover: boolean | null
          leftover_from_meal_id: string | null
          meal_plan_day_id: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          notes: string | null
          recipe_id: string
          servings: number | null
        }
        Insert: {
          id?: string
          is_leftover?: boolean | null
          leftover_from_meal_id?: string | null
          meal_plan_day_id: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          notes?: string | null
          recipe_id: string
          servings?: number | null
        }
        Update: {
          id?: string
          is_leftover?: boolean | null
          leftover_from_meal_id?: string | null
          meal_plan_day_id?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          notes?: string | null
          recipe_id?: string
          servings?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_meals_leftover_from_meal_id_fkey"
            columns: ["leftover_from_meal_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_meals_meal_plan_day_id_fkey"
            columns: ["meal_plan_day_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_meals_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string | null
          household_id: string | null
          id: string
          is_active: boolean | null
          name: string | null
          profile_id: string | null
          week_start: string
        }
        Insert: {
          created_at?: string | null
          household_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          profile_id?: string | null
          week_start: string
        }
        Update: {
          created_at?: string | null
          household_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          profile_id?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pantry_staples: {
        Row: {
          created_at: string | null
          household_id: string | null
          id: string
          name: string
          profile_id: string | null
        }
        Insert: {
          created_at?: string | null
          household_id?: string | null
          id?: string
          name: string
          profile_id?: string | null
        }
        Update: {
          created_at?: string | null
          household_id?: string | null
          id?: string
          name?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pantry_staples_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pantry_staples_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          allergies: string[] | null
          budget_level: string | null
          calorie_target: number | null
          carbs_target: number | null
          created_at: string | null
          cuisines_preferred: string[] | null
          diet_type: Database["public"]["Enums"]["diet_type"] | null
          dislikes: string[] | null
          equipment_available: string[] | null
          fat_target: number | null
          fiber_target: number | null
          id: string
          max_cook_time: number | null
          meals_per_day: number | null
          medical_diabetes_friendly: boolean | null
          medical_disclaimer_accepted: boolean | null
          medical_heart_healthy: boolean | null
          medical_kidney_friendly: boolean | null
          medical_low_sodium: boolean | null
          member_id: string | null
          plan_duration: number | null
          profile_id: string | null
          protein_target: number | null
          updated_at: string | null
        }
        Insert: {
          allergies?: string[] | null
          budget_level?: string | null
          calorie_target?: number | null
          carbs_target?: number | null
          created_at?: string | null
          cuisines_preferred?: string[] | null
          diet_type?: Database["public"]["Enums"]["diet_type"] | null
          dislikes?: string[] | null
          equipment_available?: string[] | null
          fat_target?: number | null
          fiber_target?: number | null
          id?: string
          max_cook_time?: number | null
          meals_per_day?: number | null
          medical_diabetes_friendly?: boolean | null
          medical_disclaimer_accepted?: boolean | null
          medical_heart_healthy?: boolean | null
          medical_kidney_friendly?: boolean | null
          medical_low_sodium?: boolean | null
          member_id?: string | null
          plan_duration?: number | null
          profile_id?: string | null
          protein_target?: number | null
          updated_at?: string | null
        }
        Update: {
          allergies?: string[] | null
          budget_level?: string | null
          calorie_target?: number | null
          carbs_target?: number | null
          created_at?: string | null
          cuisines_preferred?: string[] | null
          diet_type?: Database["public"]["Enums"]["diet_type"] | null
          dislikes?: string[] | null
          equipment_available?: string[] | null
          fat_target?: number | null
          fiber_target?: number | null
          id?: string
          max_cook_time?: number | null
          meals_per_day?: number | null
          medical_diabetes_friendly?: boolean | null
          medical_disclaimer_accepted?: boolean | null
          medical_heart_healthy?: boolean | null
          medical_kidney_friendly?: boolean | null
          medical_low_sodium?: boolean | null
          member_id?: string | null
          plan_duration?: number | null
          profile_id?: string | null
          protein_target?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          household_id: string | null
          id: string
          is_child: boolean | null
          locale: string | null
          onboarding_completed: boolean | null
          units: Database["public"]["Enums"]["unit_system"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          household_id?: string | null
          id?: string
          is_child?: boolean | null
          locale?: string | null
          onboarding_completed?: boolean | null
          units?: Database["public"]["Enums"]["unit_system"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          household_id?: string | null
          id?: string
          is_child?: boolean | null
          locale?: string | null
          onboarding_completed?: boolean | null
          units?: Database["public"]["Enums"]["unit_system"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          aisle: string | null
          calories: number | null
          carbs_g: number | null
          fat_g: number | null
          fiber_g: number | null
          id: string
          name: string
          normalized_name: string | null
          order_index: number | null
          protein_g: number | null
          quantity: number | null
          recipe_id: string
          section: string | null
          sodium_mg: number | null
          source_type: string | null
          sugar_g: number | null
          unit: string | null
        }
        Insert: {
          aisle?: string | null
          calories?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          name: string
          normalized_name?: string | null
          order_index?: number | null
          protein_g?: number | null
          quantity?: number | null
          recipe_id: string
          section?: string | null
          sodium_mg?: number | null
          source_type?: string | null
          sugar_g?: number | null
          unit?: string | null
        }
        Update: {
          aisle?: string | null
          calories?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          name?: string
          normalized_name?: string | null
          order_index?: number | null
          protein_g?: number | null
          quantity?: number | null
          recipe_id?: string
          section?: string | null
          sodium_mg?: number | null
          source_type?: string | null
          sugar_g?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_nutrition: {
        Row: {
          calories: number | null
          carbs_g: number | null
          cholesterol_mg: number | null
          fat_g: number | null
          fiber_g: number | null
          id: string
          protein_g: number | null
          recipe_id: string
          saturated_fat_g: number | null
          sodium_mg: number | null
          sugar_g: number | null
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          cholesterol_mg?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          protein_g?: number | null
          recipe_id: string
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          sugar_g?: number | null
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          cholesterol_mg?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          protein_g?: number | null
          recipe_id?: string
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          sugar_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_nutrition_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: true
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_steps: {
        Row: {
          id: string
          instruction: string
          introduces_section: string | null
          recipe_id: string
          step_number: number
        }
        Insert: {
          id?: string
          instruction: string
          introduces_section?: string | null
          recipe_id: string
          step_number: number
        }
        Update: {
          id?: string
          instruction?: string
          introduces_section?: string | null
          recipe_id?: string
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_tags: {
        Row: {
          id: string
          recipe_id: string
          tag_type: string
          tag_value: string
        }
        Insert: {
          id?: string
          recipe_id: string
          tag_type: string
          tag_value: string
        }
        Update: {
          id?: string
          recipe_id?: string
          tag_type?: string
          tag_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_tags_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          cook_time: number | null
          created_at: string | null
          cuisine: string | null
          deleted_at: string | null
          description: string | null
          difficulty: string | null
          household_id: string | null
          id: string
          image_url: string | null
          is_budget_friendly: boolean | null
          is_deleted: boolean
          is_kid_friendly: boolean | null
          is_meal_prep_friendly: boolean | null
          notes: string | null
          owner_user_id: string | null
          prep_time: number | null
          scope: Database["public"]["Enums"]["scope_type"] | null
          serving_size: string | null
          servings: number | null
          source_url: string | null
          title: string
          total_time: number | null
          updated_at: string | null
        }
        Insert: {
          cook_time?: number | null
          created_at?: string | null
          cuisine?: string | null
          deleted_at?: string | null
          description?: string | null
          difficulty?: string | null
          household_id?: string | null
          id?: string
          image_url?: string | null
          is_budget_friendly?: boolean | null
          is_deleted?: boolean
          is_kid_friendly?: boolean | null
          is_meal_prep_friendly?: boolean | null
          notes?: string | null
          owner_user_id?: string | null
          prep_time?: number | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          serving_size?: string | null
          servings?: number | null
          source_url?: string | null
          title: string
          total_time?: number | null
          updated_at?: string | null
        }
        Update: {
          cook_time?: number | null
          created_at?: string | null
          cuisine?: string | null
          deleted_at?: string | null
          description?: string | null
          difficulty?: string | null
          household_id?: string | null
          id?: string
          image_url?: string | null
          is_budget_friendly?: boolean | null
          is_deleted?: boolean
          is_kid_friendly?: boolean | null
          is_meal_prep_friendly?: boolean | null
          notes?: string | null
          owner_user_id?: string | null
          prep_time?: number | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          serving_size?: string | null
          servings?: number | null
          source_url?: string | null
          title?: string
          total_time?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_recipe_links: {
        Row: {
          created_at: string | null
          id: string
          recipe_id: string
          upload_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          recipe_id: string
          upload_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          recipe_id?: string
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_recipe_links_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_recipe_links_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          created_at: string | null
          error_message: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          household_id: string | null
          id: string
          owner_user_id: string
          parsed_text: string | null
          scope: Database["public"]["Enums"]["scope_type"] | null
          source_url: string | null
          status: Database["public"]["Enums"]["upload_status"] | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          household_id?: string | null
          id?: string
          owner_user_id: string
          parsed_text?: string | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["upload_status"] | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          household_id?: string | null
          id?: string
          owner_user_id?: string
          parsed_text?: string | null
          scope?: Database["public"]["Enums"]["scope_type"] | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["upload_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "uploads_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_import_jobs: {
        Row: {
          channel_name: string | null
          channel_url: string
          created_at: string
          current_batch: number
          error_message: string | null
          id: string
          owner_user_id: string
          processed_videos: number
          recipes_created: number
          status: string
          total_videos: number
          updated_at: string
          upload_id: string | null
          video_urls: string[] | null
        }
        Insert: {
          channel_name?: string | null
          channel_url: string
          created_at?: string
          current_batch?: number
          error_message?: string | null
          id?: string
          owner_user_id: string
          processed_videos?: number
          recipes_created?: number
          status?: string
          total_videos?: number
          updated_at?: string
          upload_id?: string | null
          video_urls?: string[] | null
        }
        Update: {
          channel_name?: string | null
          channel_url?: string
          created_at?: string
          current_batch?: number
          error_message?: string | null
          id?: string
          owner_user_id?: string
          processed_videos?: number
          recipes_created?: number
          status?: string
          total_videos?: number
          updated_at?: string
          upload_id?: string | null
          video_urls?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_import_jobs_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_recipe: { Args: { recipe_id_param: string }; Returns: boolean }
    }
    Enums: {
      diet_type:
        | "none"
        | "vegetarian"
        | "vegan"
        | "pescatarian"
        | "keto"
        | "paleo"
        | "mediterranean"
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
      member_role: "owner" | "admin" | "member"
      scope_type: "private" | "household" | "global"
      unit_system: "imperial" | "metric"
      upload_status: "pending" | "parsing" | "parsed" | "failed"
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
      diet_type: [
        "none",
        "vegetarian",
        "vegan",
        "pescatarian",
        "keto",
        "paleo",
        "mediterranean",
      ],
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
      member_role: ["owner", "admin", "member"],
      scope_type: ["private", "household", "global"],
      unit_system: ["imperial", "metric"],
      upload_status: ["pending", "parsing", "parsed", "failed"],
    },
  },
} as const
