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
      angebote: {
        Row: {
          analysis_summary: string | null
          created_at: string | null
          gesamtpreis: number | null
          handwerker_firma: string | null
          handwerker_name: string | null
          id: string
          original_file_name: string | null
          original_file_url: string | null
          plausibility_score: number | null
          plz: string | null
          region: string | null
          stadt: string | null
          status: string | null
          title: string
          updated_at: string | null
          upload_date: string | null
          user_id: string
        }
        Insert: {
          analysis_summary?: string | null
          created_at?: string | null
          gesamtpreis?: number | null
          handwerker_firma?: string | null
          handwerker_name?: string | null
          id?: string
          original_file_name?: string | null
          original_file_url?: string | null
          plausibility_score?: number | null
          plz?: string | null
          region?: string | null
          stadt?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          upload_date?: string | null
          user_id: string
        }
        Update: {
          analysis_summary?: string | null
          created_at?: string | null
          gesamtpreis?: number | null
          handwerker_firma?: string | null
          handwerker_name?: string | null
          id?: string
          original_file_name?: string | null
          original_file_url?: string | null
          plausibility_score?: number | null
          plz?: string | null
          region?: string | null
          stadt?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          upload_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gewerke: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      marktpreise: {
        Row: {
          datenpunkte: number | null
          einheit: string | null
          gewerk_id: string | null
          id: string
          last_updated: string | null
          material: string | null
          position_kategorie: string
          preis_durchschnitt: number | null
          preis_max: number | null
          preis_min: number | null
          region: string | null
        }
        Insert: {
          datenpunkte?: number | null
          einheit?: string | null
          gewerk_id?: string | null
          id?: string
          last_updated?: string | null
          material?: string | null
          position_kategorie: string
          preis_durchschnitt?: number | null
          preis_max?: number | null
          preis_min?: number | null
          region?: string | null
        }
        Update: {
          datenpunkte?: number | null
          einheit?: string | null
          gewerk_id?: string | null
          id?: string
          last_updated?: string | null
          material?: string | null
          position_kategorie?: string
          preis_durchschnitt?: number | null
          preis_max?: number | null
          preis_min?: number | null
          region?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marktpreise_gewerk_id_fkey"
            columns: ["gewerk_id"]
            isOneToOne: false
            referencedRelation: "gewerke"
            referencedColumns: ["id"]
          },
        ]
      }
      positionen: {
        Row: {
          abweichung_prozent: number | null
          angebot_id: string
          beschreibung: string
          created_at: string | null
          einheit: string | null
          einzelpreis: number | null
          gesamtpreis: number | null
          gewerk_id: string | null
          hinweis: string | null
          id: string
          marktpreis_durchschnitt: number | null
          marktpreis_max: number | null
          marktpreis_min: number | null
          material: string | null
          menge: number | null
          plausibility_score: number | null
          position_nummer: number | null
          status: string | null
        }
        Insert: {
          abweichung_prozent?: number | null
          angebot_id: string
          beschreibung: string
          created_at?: string | null
          einheit?: string | null
          einzelpreis?: number | null
          gesamtpreis?: number | null
          gewerk_id?: string | null
          hinweis?: string | null
          id?: string
          marktpreis_durchschnitt?: number | null
          marktpreis_max?: number | null
          marktpreis_min?: number | null
          material?: string | null
          menge?: number | null
          plausibility_score?: number | null
          position_nummer?: number | null
          status?: string | null
        }
        Update: {
          abweichung_prozent?: number | null
          angebot_id?: string
          beschreibung?: string
          created_at?: string | null
          einheit?: string | null
          einzelpreis?: number | null
          gesamtpreis?: number | null
          gewerk_id?: string | null
          hinweis?: string | null
          id?: string
          marktpreis_durchschnitt?: number | null
          marktpreis_max?: number | null
          marktpreis_min?: number | null
          material?: string | null
          menge?: number | null
          plausibility_score?: number | null
          position_nummer?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "positionen_angebot_id_fkey"
            columns: ["angebot_id"]
            isOneToOne: false
            referencedRelation: "angebote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positionen_gewerk_id_fkey"
            columns: ["gewerk_id"]
            isOneToOne: false
            referencedRelation: "gewerke"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          analyses_count: number | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          analyses_count?: number | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          analyses_count?: number | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          subscription_tier?: string | null
          updated_at?: string | null
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
