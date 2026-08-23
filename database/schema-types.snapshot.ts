// AUTO-GENERATED SNAPSHOT of the live public schema types — do not edit by hand.
// Regenerate with: pnpm schema:snapshot (prod) or pnpm schema:snapshot:local (local) — see scripts/check-schema-drift.sh
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
      active_sessions: {
        Row: {
          app_key: string
          session_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_key: string
          session_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_key?: string
          session_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_daily: {
        Row: {
          app_key: string
          day: string
          events: number
          sessions: number
          signed_out_events: number
          visitors: number
        }
        Insert: {
          app_key: string
          day: string
          events?: number
          sessions?: number
          signed_out_events?: number
          visitors?: number
        }
        Update: {
          app_key?: string
          day?: string
          events?: number
          sessions?: number
          signed_out_events?: number
          visitors?: number
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          anon_id: string
          app_key: string
          client_ts: string | null
          id: number
          name: string
          occurred_at: string
          path: string | null
          props: Json
          session_id: string
          user_id: string | null
        }
        Insert: {
          anon_id: string
          app_key: string
          client_ts?: string | null
          id?: never
          name: string
          occurred_at?: string
          path?: string | null
          props?: Json
          session_id: string
          user_id?: string | null
        }
        Update: {
          anon_id?: string
          app_key?: string
          client_ts?: string | null
          id?: never
          name?: string
          occurred_at?: string
          path?: string | null
          props?: Json
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      folders: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      mock_attempts: {
        Row: {
          boxes: Json
          created_at: string
          id: string
          pages: Json
          strokes: Json
          timer: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          boxes?: Json
          created_at?: string
          id: string
          pages?: Json
          strokes?: Json
          timer: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          boxes?: Json
          created_at?: string
          id?: string
          pages?: Json
          strokes?: Json
          timer?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      paper_files: {
        Row: {
          component: string
          created_at: string
          file_name: string
          id: number
          subject: string
        }
        Insert: {
          component: string
          created_at?: string
          file_name: string
          id?: never
          subject: string
        }
        Update: {
          component?: string
          created_at?: string
          file_name?: string
          id?: never
          subject?: string
        }
        Relationships: []
      }
      questions_metadata: {
        Row: {
          chapter_name: string
          chapter_num: number
          created_at: string | null
          id: string
          paper: string
          question_number: string
          sub_topic: string
          subject: string
        }
        Insert: {
          chapter_name: string
          chapter_num: number
          created_at?: string | null
          id: string
          paper: string
          question_number: string
          sub_topic: string
          subject: string
        }
        Update: {
          chapter_name?: string
          chapter_num?: number
          created_at?: string | null
          id?: string
          paper?: string
          question_number?: string
          sub_topic?: string
          subject?: string
        }
        Relationships: []
      }
      recall_cards: {
        Row: {
          chapter_id: string
          created_at: string
          definition: string
          id: string
          sort_order: number
          term: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          definition: string
          id?: string
          sort_order?: number
          term: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          definition?: string
          id?: string
          sort_order?: number
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "recall_cards_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "recall_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      recall_chapters: {
        Row: {
          created_at: string
          id: string
          name: string
          section_id: string
          section_name: string
          section_sort_order: number
          sort_order: number
          subject_emoji: string
          subject_id: string
          subject_name: string
          subject_sort_order: number
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          section_id: string
          section_name: string
          section_sort_order?: number
          sort_order?: number
          subject_emoji: string
          subject_id: string
          subject_name: string
          subject_sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          section_id?: string
          section_name?: string
          section_sort_order?: number
          sort_order?: number
          subject_emoji?: string
          subject_id?: string
          subject_name?: string
          subject_sort_order?: number
        }
        Relationships: []
      }
      recall_disabled: {
        Row: {
          entity_id: string
          entity_type: string
        }
        Insert: {
          entity_id: string
          entity_type: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
        }
        Relationships: []
      }
      recall_progress: {
        Row: {
          chapter_id: string
          id: string
          pass: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          id?: string
          pass?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          id?: string
          pass?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recall_progress_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "recall_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      recall_two_sider_points: {
        Row: {
          id: string
          keyword: string
          point: string
          side: string
          sort_order: number
          two_sider_id: string
        }
        Insert: {
          id?: string
          keyword: string
          point: string
          side: string
          sort_order?: number
          two_sider_id: string
        }
        Update: {
          id?: string
          keyword?: string
          point?: string
          side?: string
          sort_order?: number
          two_sider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recall_two_sider_points_two_sider_id_fkey"
            columns: ["two_sider_id"]
            isOneToOne: false
            referencedRelation: "recall_two_siders"
            referencedColumns: ["id"]
          },
        ]
      }
      recall_two_siders: {
        Row: {
          against_label: string
          available: boolean
          created_at: string
          emoji: string
          for_label: string
          id: string
          question: string
          sort_order: number
          subject: string
        }
        Insert: {
          against_label?: string
          available?: boolean
          created_at?: string
          emoji?: string
          for_label?: string
          id: string
          question: string
          sort_order?: number
          subject: string
        }
        Update: {
          against_label?: string
          available?: boolean
          created_at?: string
          emoji?: string
          for_label?: string
          id?: string
          question?: string
          sort_order?: number
          subject?: string
        }
        Relationships: []
      }
      scholium_apps: {
        Row: {
          created_at: string | null
          description: string | null
          has_demo: boolean
          icon: string | null
          id: string
          no_login: boolean
          sort_order: number
          subjects: string[]
          title: string
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          has_demo?: boolean
          icon?: string | null
          id?: string
          no_login?: boolean
          sort_order?: number
          subjects?: string[]
          title: string
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          has_demo?: boolean
          icon?: string | null
          id?: string
          no_login?: boolean
          sort_order?: number
          subjects?: string[]
          title?: string
          url?: string
        }
        Relationships: []
      }
      set_progress: {
        Row: {
          correct_count: number | null
          created_at: string | null
          id: string
          item_id: string | null
          last_practiced: string | null
          mastered: boolean | null
          set_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          correct_count?: number | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          last_practiced?: string | null
          mastered?: boolean | null
          set_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          correct_count?: number | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          last_practiced?: string | null
          mastered?: boolean | null
          set_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "set_progress_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "vocabulary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_progress_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "vocabulary_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_prefs: {
        Row: {
          analytics_opt_out: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          analytics_opt_out?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          analytics_opt_out?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vocabulary_items: {
        Row: {
          created_at: string | null
          definition: string
          id: string
          set_id: string | null
          term: string
        }
        Insert: {
          created_at?: string | null
          definition: string
          id?: string
          set_id?: string | null
          term: string
        }
        Update: {
          created_at?: string | null
          definition?: string
          id?: string
          set_id?: string | null
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_items_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "vocabulary_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_sets: {
        Row: {
          created_at: string | null
          description: string | null
          folder_id: string | null
          id: string
          language: string
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          language?: string
          name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          language?: string
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_sets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _assert_admin: { Args: never; Returns: undefined }
      admin_analytics_daily: {
        Args: { p_app_key?: string; p_days?: number }
        Returns: {
          day: string
          events: number
          sessions: number
          signed_out_events: number
          visitors: number
        }[]
      }
      admin_analytics_events: {
        Args: { p_app_key?: string; p_days?: number }
        Returns: {
          event_name: string
          events: number
          visitors: number
        }[]
      }
      admin_analytics_funnel: {
        Args: { p_app_key: string; p_days?: number; p_steps: string[] }
        Returns: {
          step_index: number
          step_name: string
          visitors: number
        }[]
      }
      admin_analytics_overview: {
        Args: { p_days?: number }
        Returns: {
          app_key: string
          dau: number
          events: number
          mau: number
          sessions: number
          signed_out_pct: number
          wau: number
        }[]
      }
      admin_analytics_retention: {
        Args: { p_app_key: string; p_weeks?: number }
        Returns: {
          cohort_week: string
          users: number
          week_offset: number
        }[]
      }
      admin_delete_chapter: { Args: { p_id: string }; Returns: undefined }
      admin_delete_two_sider: { Args: { p_id: string }; Returns: undefined }
      admin_rename_section: {
        Args: { p_new_name: string; p_section_id: string }
        Returns: undefined
      }
      admin_rename_subject: {
        Args: { p_new_emoji: string; p_new_name: string; p_subject_id: string }
        Returns: undefined
      }
      admin_save_chapter: {
        Args: {
          p_cards: Json
          p_id: string
          p_name: string
          p_section_id: string
          p_section_name: string
          p_sort_order: number
          p_subject_emoji: string
          p_subject_id: string
          p_subject_name: string
        }
        Returns: undefined
      }
      admin_save_two_sider: {
        Args: {
          p_against: Json
          p_against_label: string
          p_emoji: string
          p_for: Json
          p_for_label: string
          p_id: string
          p_question: string
          p_sort_order: number
          p_subject: string
        }
        Returns: undefined
      }
      admin_set_disabled: {
        Args: {
          p_disabled: boolean
          p_entity_id: string
          p_entity_type: string
        }
        Returns: undefined
      }
      admin_set_two_sider_available: {
        Args: { p_available: boolean; p_id: string }
        Returns: undefined
      }
      admin_swap_chapter_order: {
        Args: { p_id_a: string; p_id_b: string }
        Returns: undefined
      }
      admin_swap_section_order: {
        Args: { p_section_id_a: string; p_section_id_b: string }
        Returns: undefined
      }
      admin_swap_subject_order: {
        Args: { p_subject_id_a: string; p_subject_id_b: string }
        Returns: undefined
      }
      admin_swap_two_sider_order: {
        Args: { p_id_a: string; p_id_b: string }
        Returns: undefined
      }
      get_user_stats: {
        Args: never
        Returns: {
          email: string
          id: string
          language_rows: number
          last_active_at: string
          last_sign_in_at: string
          recall_chapters: number
          recall_pass_sum: number
          signed_up_at: string
        }[]
      }
      practice_sample: {
        Args: { sample_count: number }
        Returns: {
          definition: string
          id: string
          language: string
          set_id: string
          term: string
        }[]
      }
      practice_sample_folder: {
        Args: { sample_count: number; target_folder: string }
        Returns: {
          definition: string
          id: string
          language: string
          set_id: string
          term: string
        }[]
      }
      refresh_analytics_daily: {
        Args: { p_trailing_days?: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
