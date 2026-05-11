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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      adaptive_memory: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key: string
          memory_type: string
          relevance_score: number | null
          subject_id: string | null
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key: string
          memory_type?: string
          relevance_score?: number | null
          subject_id?: string | null
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key?: string
          memory_type?: string
          relevance_score?: number | null
          subject_id?: string | null
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      ai_verification_log: {
        Row: {
          generated_answer: string
          id: string
          question: string
          user_id: string
          verification_result: Json | null
          verified_at: string
        }
        Insert: {
          generated_answer: string
          id?: string
          question: string
          user_id: string
          verification_result?: Json | null
          verified_at?: string
        }
        Update: {
          generated_answer?: string
          id?: string
          question?: string
          user_id?: string
          verification_result?: Json | null
          verified_at?: string
        }
        Relationships: []
      }
      book_pages: {
        Row: {
          chapter_id: string | null
          chapter_name: string | null
          class_level: string
          created_at: string
          extracted_text: string | null
          id: string
          image_url: string
          is_archived: boolean | null
          notes: string | null
          ocr_status: string | null
          page_number: number | null
          structured_content: Json | null
          subject_id: string
          tags: string[] | null
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          chapter_name?: string | null
          class_level: string
          created_at?: string
          extracted_text?: string | null
          id?: string
          image_url: string
          is_archived?: boolean | null
          notes?: string | null
          ocr_status?: string | null
          page_number?: number | null
          structured_content?: Json | null
          subject_id: string
          tags?: string[] | null
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          chapter_name?: string | null
          class_level?: string
          created_at?: string
          extracted_text?: string | null
          id?: string
          image_url?: string
          is_archived?: boolean | null
          notes?: string | null
          ocr_status?: string | null
          page_number?: number | null
          structured_content?: Json | null
          subject_id?: string
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_pages_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "syllabus_library"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          lesson_id: string | null
          note: string | null
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id?: string | null
          note?: string | null
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string | null
          note?: string | null
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          subject_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          subject_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: []
      }
      concept_graph: {
        Row: {
          chapter_id: string | null
          concept_name: string
          created_at: string
          difficulty_level: number | null
          id: string
          metadata: Json | null
          parent_concept_id: string | null
          subject_id: string
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          concept_name: string
          created_at?: string
          difficulty_level?: number | null
          id?: string
          metadata?: Json | null
          parent_concept_id?: string | null
          subject_id: string
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          concept_name?: string
          created_at?: string
          difficulty_level?: number | null
          id?: string
          metadata?: Json | null
          parent_concept_id?: string | null
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_graph_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "syllabus_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_graph_parent_concept_id_fkey"
            columns: ["parent_concept_id"]
            isOneToOne: false
            referencedRelation: "concept_graph"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_mastery: {
        Row: {
          attempts: number | null
          concept_id: string
          correct_count: number | null
          created_at: string
          difficulty_calibration: number | null
          id: string
          is_weak: boolean | null
          last_practiced_at: string | null
          last_scores: Json | null
          mastery_score: number | null
          streak: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          concept_id: string
          correct_count?: number | null
          created_at?: string
          difficulty_calibration?: number | null
          id?: string
          is_weak?: boolean | null
          last_practiced_at?: string | null
          last_scores?: Json | null
          mastery_score?: number | null
          streak?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          concept_id?: string
          correct_count?: number | null
          created_at?: string
          difficulty_calibration?: number | null
          id?: string
          is_weak?: boolean | null
          last_practiced_at?: string | null
          last_scores?: Json | null
          mastery_score?: number | null
          streak?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_mastery_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concept_graph"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          chapter_id: string | null
          correct_answers: number
          created_at: string
          exam_type: string
          id: string
          mistakes: Json | null
          subject_id: string
          time_taken_seconds: number | null
          total_questions: number
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          correct_answers: number
          created_at?: string
          exam_type: string
          id?: string
          mistakes?: Json | null
          subject_id: string
          time_taken_seconds?: number | null
          total_questions: number
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          correct_answers?: number
          created_at?: string
          exam_type?: string
          id?: string
          mistakes?: Json | null
          subject_id?: string
          time_taken_seconds?: number | null
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "syllabus_library"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_assignments: {
        Row: {
          class_id: string
          content: string | null
          created_at: string
          id: string
          image_urls: Json | null
          subject_id: string | null
          teacher_id: string
          title: string
          type: string
        }
        Insert: {
          class_id: string
          content?: string | null
          created_at?: string
          id?: string
          image_urls?: Json | null
          subject_id?: string | null
          teacher_id: string
          title?: string
          type?: string
        }
        Update: {
          class_id?: string
          content?: string | null
          created_at?: string
          id?: string
          image_urls?: Json | null
          subject_id?: string | null
          teacher_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_activity: {
        Row: {
          activity_type: string
          chapter_id: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          metadata: Json | null
          score: number | null
          subject_id: string
          user_id: string
        }
        Insert: {
          activity_type: string
          chapter_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          metadata?: Json | null
          score?: number | null
          subject_id: string
          user_id: string
        }
        Update: {
          activity_type?: string
          chapter_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          metadata?: Json | null
          score?: number | null
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_activity_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "syllabus_library"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          chapter_order: number
          content: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          subject_id: string
          title: string
          video_url: string | null
        }
        Insert: {
          chapter_order?: number
          content?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          subject_id: string
          title: string
          video_url?: string | null
        }
        Update: {
          chapter_order?: number
          content?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          subject_id?: string
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
      practice_questions: {
        Row: {
          correct_answer: number
          created_at: string
          difficulty: string | null
          explanation: string | null
          id: string
          lesson_id: string | null
          options: Json
          question: string
          subject_id: string
        }
        Insert: {
          correct_answer: number
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          lesson_id?: string | null
          options?: Json
          question: string
          subject_id: string
        }
        Update: {
          correct_answer?: number
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          lesson_id?: string | null
          options?: Json
          question?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          class_level: string | null
          created_at: string
          default_language: string | null
          email: string
          id: string
          name: string
          personality: string | null
          preferred_language: string | null
          school_name: string | null
          selected_subjects: string[] | null
          study_medium: string | null
          updated_at: string
          user_id: string
          user_role: string
        }
        Insert: {
          age?: number | null
          class_level?: string | null
          created_at?: string
          default_language?: string | null
          email?: string
          id?: string
          name?: string
          personality?: string | null
          preferred_language?: string | null
          school_name?: string | null
          selected_subjects?: string[] | null
          study_medium?: string | null
          updated_at?: string
          user_id: string
          user_role?: string
        }
        Update: {
          age?: number | null
          class_level?: string | null
          created_at?: string
          default_language?: string | null
          email?: string
          id?: string
          name?: string
          personality?: string | null
          preferred_language?: string | null
          school_name?: string | null
          selected_subjects?: string[] | null
          study_medium?: string | null
          updated_at?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      student_teacher_links: {
        Row: {
          created_at: string
          id: string
          linked_subjects: string[] | null
          student_user_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_subjects?: string[] | null
          student_user_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_subjects?: string[] | null
          student_user_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_teacher_links_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_streaks: {
        Row: {
          created_at: string
          current_streak: number | null
          id: string
          last_study_date: string | null
          longest_streak: number | null
          total_study_days: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number | null
          id?: string
          last_study_date?: string | null
          longest_streak?: number | null
          total_study_days?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number | null
          id?: string
          last_study_date?: string | null
          longest_streak?: number | null
          total_study_days?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subject_mastery: {
        Row: {
          chapter_id: string | null
          created_at: string
          id: string
          last_activity_at: string | null
          mastery_score: number | null
          subject_id: string
          updated_at: string
          user_id: string
          weakness_tags: string[] | null
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string | null
          mastery_score?: number | null
          subject_id: string
          updated_at?: string
          user_id: string
          weakness_tags?: string[] | null
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string | null
          mastery_score?: number | null
          subject_id?: string
          updated_at?: string
          user_id?: string
          weakness_tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_mastery_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "syllabus_library"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_library: {
        Row: {
          chapter_name: string
          chapter_order: number
          class_level: string
          created_at: string
          id: string
          is_archived: boolean | null
          subject_id: string
          topics: string[] | null
          updated_at: string
          upload_type: string | null
          user_id: string
        }
        Insert: {
          chapter_name: string
          chapter_order?: number
          class_level: string
          created_at?: string
          id?: string
          is_archived?: boolean | null
          subject_id: string
          topics?: string[] | null
          updated_at?: string
          upload_type?: string | null
          user_id: string
        }
        Update: {
          chapter_name?: string
          chapter_order?: number
          class_level?: string
          created_at?: string
          id?: string
          is_archived?: boolean | null
          subject_id?: string
          topics?: string[] | null
          updated_at?: string
          upload_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teacher_classes: {
        Row: {
          class_level: string
          created_at: string
          id: string
          section_name: string | null
          teacher_id: string
        }
        Insert: {
          class_level: string
          created_at?: string
          id?: string
          section_name?: string | null
          teacher_id: string
        }
        Update: {
          class_level?: string
          created_at?: string
          id?: string
          section_name?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_profiles: {
        Row: {
          created_at: string
          gender: string
          id: string
          name: string
          school_name: string
          teacher_id_display: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gender?: string
          id?: string
          name?: string
          school_name?: string
          teacher_id_display?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gender?: string
          id?: string
          name?: string
          school_name?: string
          teacher_id_display?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_student_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          media_url: string | null
          message_type: string
          read_at: string | null
          receiver_user_id: string
          sender_user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          receiver_user_id: string
          sender_user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          receiver_user_id?: string
          sender_user_id?: string
        }
        Relationships: []
      }
      teacher_subjects: {
        Row: {
          created_at: string
          id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: string | null
          score: number | null
          subject_id: string
          time_spent_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          score?: number | null
          subject_id: string
          time_spent_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          score?: number | null
          subject_id?: string
          time_spent_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      teacher_student_kpis: {
        Row: {
          teacher_profile_id: string
          teacher_user_id: string
          student_user_id: string
          activities_30d: number
          study_minutes_30d: number
          last_activity_at: string | null
          avg_chapter_mastery: number | null
          exams_30d: number
          avg_exam_score_pct_30d: number | null
        }
        Relationships: []
      }
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
