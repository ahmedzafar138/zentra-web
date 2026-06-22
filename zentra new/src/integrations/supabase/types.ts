export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          height_cm: number | null;
          weight_kg: number | null;
          height_unit: string | null;
          weight_unit: string | null;
          avatar_url: string | null;
          onboarding_completed: boolean | null;
          steps_goal: number | null;
          bmi: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string;
          last_name?: string;
          height_cm?: number | null;
          weight_kg?: number | null;
          height_unit?: string | null;
          weight_unit?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean | null;
          steps_goal?: number | null;
          bmi?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          height_cm?: number | null;
          weight_kg?: number | null;
          height_unit?: string | null;
          weight_unit?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean | null;
          steps_goal?: number | null;
          bmi?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      step_tracking: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          steps: number | null;
          goal: number | null;
          kcal: number | null;
          distance_km: number | null;
          active_minutes: number | null;
          streak_days: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date?: string;
          steps?: number | null;
          goal?: number | null;
          kcal?: number | null;
          distance_km?: number | null;
          active_minutes?: number | null;
          streak_days?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          steps?: number | null;
          goal?: number | null;
          kcal?: number | null;
          distance_km?: number | null;
          active_minutes?: number | null;
          streak_days?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          title: string;
          meal_type: "breakfast" | "lunch" | "dinner" | "snacks";
          calories: number | null;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          ingredients: Json;
          steps: Json;
          prep_time_min: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          meal_type: "breakfast" | "lunch" | "dinner" | "snacks";
          calories?: number | null;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          ingredients?: Json;
          steps?: Json;
          prep_time_min?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          meal_type?: "breakfast" | "lunch" | "dinner" | "snacks";
          calories?: number | null;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          ingredients?: Json;
          steps?: Json;
          prep_time_min?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      meal_plans: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string;
          culinary_preference: string | null;
          dietary_preference: string | null;
          goal: string | null;
          total_calories: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start_date: string;
          culinary_preference?: string | null;
          dietary_preference?: string | null;
          goal?: string | null;
          total_calories?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start_date?: string;
          culinary_preference?: string | null;
          dietary_preference?: string | null;
          goal?: string | null;
          total_calories?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      meal_plan_items: {
        Row: {
          id: string;
          meal_plan_id: string;
          day_of_week: number;
          meal_type: "breakfast" | "lunch" | "dinner" | "snacks";
          recipe_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meal_plan_id: string;
          day_of_week: number;
          meal_type: "breakfast" | "lunch" | "dinner" | "snacks";
          recipe_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          meal_plan_id?: string;
          day_of_week?: number;
          meal_type?: "breakfast" | "lunch" | "dinner" | "snacks";
          recipe_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          muscle_group: string;
          exercise_name: string;
          correct_reps: number | null;
          incorrect_reps: number | null;
          duration_seconds: number | null;
          date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          muscle_group: string;
          exercise_name: string;
          correct_reps?: number | null;
          incorrect_reps?: number | null;
          duration_seconds?: number | null;
          date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          muscle_group?: string;
          exercise_name?: string;
          correct_reps?: number | null;
          incorrect_reps?: number | null;
          duration_seconds?: number | null;
          date?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_chat_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: "user" | "assistant";
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      blog_posts: {
        Row: {
          id: string;
          title: string;
          snippet: string;
          content: string;
          category: string;
          read_time_min: number | null;
          published_at: string;
          thumbnail_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          snippet: string;
          content: string;
          category: string;
          read_time_min?: number | null;
          published_at?: string;
          thumbnail_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          snippet?: string;
          content?: string;
          category?: string;
          read_time_min?: number | null;
          published_at?: string;
          thumbnail_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      saved_blogs: {
        Row: {
          id: string;
          user_id: string;
          blog_post_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          blog_post_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          blog_post_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_logs_history: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          exercise_name: string;
          muscle_group: string;
          sets: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          exercise_name: string;
          muscle_group: string;
          sets?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: string;
          exercise_name?: string;
          muscle_group?: string;
          sets?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_meal_history: {
        Row: {
          id: string;
          user_id: string;
          week_start_date: string;
          meal_plan_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start_date: string;
          meal_plan_data: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start_date?: string;
          meal_plan_data?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      user_steps_history: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          daily_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          daily_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: string;
          daily_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shopping_lists: {
        Row: {
          id: string;
          user_id: string;
          meal_plan_id: string | null;
          items: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          meal_plan_id?: string | null;
          items: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          meal_plan_id?: string | null;
          items?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      user_form_sessions: {
        Row: {
          id: string;
          user_id: string;
          group_name: string;
          exercise_name: string;
          started_at: string;
          ended_at: string;
          duration_seconds: number;
          total_reps: number;
          correct_reps: number;
          incorrect_reps: number;
          feedback: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          group_name: string;
          exercise_name: string;
          started_at: string;
          ended_at: string;
          duration_seconds?: number;
          total_reps?: number;
          correct_reps?: number;
          incorrect_reps?: number;
          feedback?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          group_name?: string;
          exercise_name?: string;
          started_at?: string;
          ended_at?: string;
          duration_seconds?: number;
          total_reps?: number;
          correct_reps?: number;
          incorrect_reps?: number;
          feedback?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Update"];

export const Constants = {
  public: { Enums: {} },
} as const;
