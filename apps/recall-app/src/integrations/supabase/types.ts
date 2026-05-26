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
