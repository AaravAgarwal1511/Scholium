export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      recall_cards: {
        Row: {
          id: string
          chapter_id: string
          term: string
          definition: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          chapter_id: string
          term: string
          definition: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          chapter_id?: string
          term?: string
          definition?: string
          sort_order?: number
          created_at?: string
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
          id: string
          subject_id: string
          subject_name: string
          subject_emoji: string
          section_id: string
          section_name: string
          name: string
          sort_order: number
          section_sort_order: number
          subject_sort_order: number
          created_at: string
        }
        Insert: {
          id: string
          subject_id: string
          subject_name: string
          subject_emoji: string
          section_id: string
          section_name: string
          name: string
          sort_order?: number
          section_sort_order?: number
          subject_sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          subject_id?: string
          subject_name?: string
          subject_emoji?: string
          section_id?: string
          section_name?: string
          name?: string
          sort_order?: number
          section_sort_order?: number
          subject_sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      recall_progress: {
        Row: {
          id: string
          user_id: string
          chapter_id: string
          pass: number
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          chapter_id: string
          pass?: number
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          chapter_id?: string
          pass?: number
          updated_at?: string
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
      recall_two_siders: {
        Row: {
          id: string
          subject: string
          emoji: string
          question: string
          marks: number | null
          for_label: string
          against_label: string
          available: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id: string
          subject: string
          emoji?: string
          question: string
          marks?: number | null
          for_label?: string
          against_label?: string
          available?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          subject?: string
          emoji?: string
          question?: string
          marks?: number | null
          for_label?: string
          against_label?: string
          available?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      recall_two_sider_points: {
        Row: {
          id: string
          two_sider_id: string
          side: string
          keyword: string
          point: string
          sort_order: number
        }
        Insert: {
          id?: string
          two_sider_id: string
          side: string
          keyword: string
          point: string
          sort_order?: number
        }
        Update: {
          id?: string
          two_sider_id?: string
          side?: string
          keyword?: string
          point?: string
          sort_order?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
