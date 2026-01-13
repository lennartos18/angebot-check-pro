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
          anonymized_document_id: string | null
          created_at: string | null
          document_type: string | null
          gesamtpreis: number | null
          handwerker_firma: string | null
          handwerker_name: string | null
          id: string
          original_file_name: string | null
          original_file_url: string | null
          plausibility_score: number | null
          plz: string | null
          region: string | null
          service_domain: string | null
          stadt: string | null
          status: string | null
          title: string
          updated_at: string | null
          upload_date: string | null
          user_id: string
        }
        Insert: {
          analysis_summary?: string | null
          anonymized_document_id?: string | null
          created_at?: string | null
          document_type?: string | null
          gesamtpreis?: number | null
          handwerker_firma?: string | null
          handwerker_name?: string | null
          id?: string
          original_file_name?: string | null
          original_file_url?: string | null
          plausibility_score?: number | null
          plz?: string | null
          region?: string | null
          service_domain?: string | null
          stadt?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          upload_date?: string | null
          user_id: string
        }
        Update: {
          analysis_summary?: string | null
          anonymized_document_id?: string | null
          created_at?: string | null
          document_type?: string | null
          gesamtpreis?: number | null
          handwerker_firma?: string | null
          handwerker_name?: string | null
          id?: string
          original_file_name?: string | null
          original_file_url?: string | null
          plausibility_score?: number | null
          plz?: string | null
          region?: string | null
          service_domain?: string | null
          stadt?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          upload_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "angebote_anonymized_document_id_fkey"
            columns: ["anonymized_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_positions: {
        Row: {
          comparison_eligible: boolean | null
          created_at: string | null
          document_id: string
          id: string
          normalization_confidence: number | null
          normalization_status: string | null
          normalized_material_id: string | null
          normalized_service_id: string | null
          position_date: string | null
          position_type: string
          quantity: number | null
          raw_text: string
          region_cluster_id: string | null
          service_domain: string | null
          tax_rate: number | null
          time_bucket: string | null
          total_price: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          comparison_eligible?: boolean | null
          created_at?: string | null
          document_id: string
          id?: string
          normalization_confidence?: number | null
          normalization_status?: string | null
          normalized_material_id?: string | null
          normalized_service_id?: string | null
          position_date?: string | null
          position_type: string
          quantity?: number | null
          raw_text: string
          region_cluster_id?: string | null
          service_domain?: string | null
          tax_rate?: number | null
          time_bucket?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          comparison_eligible?: boolean | null
          created_at?: string | null
          document_id?: string
          id?: string
          normalization_confidence?: number | null
          normalization_status?: string | null
          normalized_material_id?: string | null
          normalized_service_id?: string | null
          position_date?: string | null
          position_type?: string
          quantity?: number | null
          raw_text?: string
          region_cluster_id?: string | null
          service_domain?: string | null
          tax_rate?: number | null
          time_bucket?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_positions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_positions_normalized_material_id_fkey"
            columns: ["normalized_material_id"]
            isOneToOne: false
            referencedRelation: "normalized_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_positions_normalized_service_id_fkey"
            columns: ["normalized_service_id"]
            isOneToOne: false
            referencedRelation: "normalized_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_positions_region_cluster_id_fkey"
            columns: ["region_cluster_id"]
            isOneToOne: false
            referencedRelation: "region_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          anonymized_customer_id: string | null
          anonymized_provider_id: string | null
          created_at: string | null
          currency: string | null
          document_type: string
          id: string
          position_count: number | null
          region_cluster_id: string | null
          service_domain: string
          submission_date: string
          time_bucket: string
          total_gross_amount: number | null
          total_net_amount: number | null
        }
        Insert: {
          anonymized_customer_id?: string | null
          anonymized_provider_id?: string | null
          created_at?: string | null
          currency?: string | null
          document_type: string
          id?: string
          position_count?: number | null
          region_cluster_id?: string | null
          service_domain: string
          submission_date?: string
          time_bucket: string
          total_gross_amount?: number | null
          total_net_amount?: number | null
        }
        Update: {
          anonymized_customer_id?: string | null
          anonymized_provider_id?: string | null
          created_at?: string | null
          currency?: string | null
          document_type?: string
          id?: string
          position_count?: number | null
          region_cluster_id?: string | null
          service_domain?: string
          submission_date?: string
          time_bucket?: string
          total_gross_amount?: number | null
          total_net_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_region_cluster_id_fkey"
            columns: ["region_cluster_id"]
            isOneToOne: false
            referencedRelation: "region_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      external_marktpreise_cache: {
        Row: {
          created_at: string | null
          expires_at: string | null
          gewerk: string | null
          id: string
          kategorie: string | null
          preis_durchschnitt: number | null
          preis_max: number | null
          preis_min: number | null
          quellen: string[] | null
          raw_data: Json | null
          suchbegriff: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          gewerk?: string | null
          id?: string
          kategorie?: string | null
          preis_durchschnitt?: number | null
          preis_max?: number | null
          preis_min?: number | null
          quellen?: string[] | null
          raw_data?: Json | null
          suchbegriff: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          gewerk?: string | null
          id?: string
          kategorie?: string | null
          preis_durchschnitt?: number | null
          preis_max?: number | null
          preis_min?: number | null
          quellen?: string[] | null
          raw_data?: Json | null
          suchbegriff?: string
        }
        Relationships: []
      }
      external_reference_data: {
        Row: {
          bundesland: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          normalized_material_id: string | null
          normalized_service_id: string | null
          price_max: number | null
          price_median: number | null
          price_min: number | null
          region_type: string | null
          service_domain: string
          source_date: string
          source_name: string
          source_type: string
          source_url: string | null
          unit: string | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          bundesland?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          normalized_material_id?: string | null
          normalized_service_id?: string | null
          price_max?: number | null
          price_median?: number | null
          price_min?: number | null
          region_type?: string | null
          service_domain: string
          source_date: string
          source_name: string
          source_type: string
          source_url?: string | null
          unit?: string | null
          valid_from?: string
          valid_until: string
        }
        Update: {
          bundesland?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          normalized_material_id?: string | null
          normalized_service_id?: string | null
          price_max?: number | null
          price_median?: number | null
          price_min?: number | null
          region_type?: string | null
          service_domain?: string
          source_date?: string
          source_name?: string
          source_type?: string
          source_url?: string | null
          unit?: string | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_reference_data_normalized_material_id_fkey"
            columns: ["normalized_material_id"]
            isOneToOne: false
            referencedRelation: "normalized_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_reference_data_normalized_service_id_fkey"
            columns: ["normalized_service_id"]
            isOneToOne: false
            referencedRelation: "normalized_services"
            referencedColumns: ["id"]
          },
        ]
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
      guest_payments: {
        Row: {
          amount_cents: number | null
          completed_at: string | null
          created_at: string | null
          currency: string | null
          customer_email: string | null
          id: string
          pdf_token: string | null
          pdf_url: string | null
          session_id: string | null
          status: string | null
          stripe_payment_intent: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          id?: string
          pdf_token?: string | null
          pdf_url?: string | null
          session_id?: string | null
          status?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          id?: string
          pdf_token?: string | null
          pdf_url?: string | null
          session_id?: string | null
          status?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sessions: {
        Row: {
          analysis_json: Json | null
          created_at: string | null
          documents_json: Json | null
          email: string | null
          expires_at: string | null
          id: string
          ip_hash: string | null
          plz: string | null
          session_token: string
          stadt: string | null
        }
        Insert: {
          analysis_json?: Json | null
          created_at?: string | null
          documents_json?: Json | null
          email?: string | null
          expires_at?: string | null
          id?: string
          ip_hash?: string | null
          plz?: string | null
          session_token: string
          stadt?: string | null
        }
        Update: {
          analysis_json?: Json | null
          created_at?: string | null
          documents_json?: Json | null
          email?: string | null
          expires_at?: string | null
          id?: string
          ip_hash?: string | null
          plz?: string | null
          session_token?: string
          stadt?: string | null
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
      normalization_stopwords: {
        Row: {
          created_at: string | null
          id: string
          word: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          word: string
        }
        Update: {
          created_at?: string | null
          id?: string
          word?: string
        }
        Relationships: []
      }
      normalization_synonyms: {
        Row: {
          canonical_term: string
          created_at: string | null
          id: string
          service_domain: string
          synonym: string
          weight: number | null
        }
        Insert: {
          canonical_term: string
          created_at?: string | null
          id?: string
          service_domain: string
          synonym: string
          weight?: number | null
        }
        Update: {
          canonical_term?: string
          created_at?: string | null
          id?: string
          service_domain?: string
          synonym?: string
          weight?: number | null
        }
        Relationships: []
      }
      normalized_materials: {
        Row: {
          created_at: string | null
          id: string
          keywords: string[] | null
          material_category: string | null
          name: string
          service_domain: string
          standard_unit: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          material_category?: string | null
          name: string
          service_domain: string
          standard_unit?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          material_category?: string | null
          name?: string
          service_domain?: string
          standard_unit?: string | null
        }
        Relationships: []
      }
      normalized_services: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          keywords: string[] | null
          name: string
          service_domain: string
          standard_unit: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          keywords?: string[] | null
          name: string
          service_domain: string
          standard_unit?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          keywords?: string[] | null
          name?: string
          service_domain?: string
          standard_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "normalized_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
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
          datengrundlage: string | null
          datenquelle: string | null
          einheit: string | null
          einordnung_begruendung: string | null
          einordnung_stufe: string | null
          einzelpreis: number | null
          gesamtpreis: number | null
          gewerk_id: string | null
          hinweis: string | null
          id: string
          interne_vergleiche: number | null
          marktpreis_durchschnitt: number | null
          marktpreis_max: number | null
          marktpreis_min: number | null
          material: string | null
          menge: number | null
          plausibility_score: number | null
          position_nummer: number | null
          status: string | null
          unsicherheitshinweis: string | null
        }
        Insert: {
          abweichung_prozent?: number | null
          angebot_id: string
          beschreibung: string
          created_at?: string | null
          datengrundlage?: string | null
          datenquelle?: string | null
          einheit?: string | null
          einordnung_begruendung?: string | null
          einordnung_stufe?: string | null
          einzelpreis?: number | null
          gesamtpreis?: number | null
          gewerk_id?: string | null
          hinweis?: string | null
          id?: string
          interne_vergleiche?: number | null
          marktpreis_durchschnitt?: number | null
          marktpreis_max?: number | null
          marktpreis_min?: number | null
          material?: string | null
          menge?: number | null
          plausibility_score?: number | null
          position_nummer?: number | null
          status?: string | null
          unsicherheitshinweis?: string | null
        }
        Update: {
          abweichung_prozent?: number | null
          angebot_id?: string
          beschreibung?: string
          created_at?: string | null
          datengrundlage?: string | null
          datenquelle?: string | null
          einheit?: string | null
          einordnung_begruendung?: string | null
          einordnung_stufe?: string | null
          einzelpreis?: number | null
          gesamtpreis?: number | null
          gewerk_id?: string | null
          hinweis?: string | null
          id?: string
          interne_vergleiche?: number | null
          marktpreis_durchschnitt?: number | null
          marktpreis_max?: number | null
          marktpreis_min?: number | null
          material?: string | null
          menge?: number | null
          plausibility_score?: number | null
          position_nummer?: number | null
          status?: string | null
          unsicherheitshinweis?: string | null
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
      price_evaluations: {
        Row: {
          created_at: string | null
          data_basis_description: string
          data_source: string
          deviation_percent: number | null
          evaluation_level: string
          evaluation_reason: string
          external_reference_used: boolean | null
          external_source_name: string | null
          id: string
          internal_comparison_count: number | null
          median: number | null
          normalized_material_id: string | null
          normalized_service_id: string | null
          position_id: string
          quartile_1: number | null
          quartile_3: number | null
          region_cluster_id: string | null
          uncertainty_note: string | null
        }
        Insert: {
          created_at?: string | null
          data_basis_description: string
          data_source: string
          deviation_percent?: number | null
          evaluation_level: string
          evaluation_reason: string
          external_reference_used?: boolean | null
          external_source_name?: string | null
          id?: string
          internal_comparison_count?: number | null
          median?: number | null
          normalized_material_id?: string | null
          normalized_service_id?: string | null
          position_id: string
          quartile_1?: number | null
          quartile_3?: number | null
          region_cluster_id?: string | null
          uncertainty_note?: string | null
        }
        Update: {
          created_at?: string | null
          data_basis_description?: string
          data_source?: string
          deviation_percent?: number | null
          evaluation_level?: string
          evaluation_reason?: string
          external_reference_used?: boolean | null
          external_source_name?: string | null
          id?: string
          internal_comparison_count?: number | null
          median?: number | null
          normalized_material_id?: string | null
          normalized_service_id?: string | null
          position_id?: string
          quartile_1?: number | null
          quartile_3?: number | null
          region_cluster_id?: string | null
          uncertainty_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_evaluations_normalized_material_id_fkey"
            columns: ["normalized_material_id"]
            isOneToOne: false
            referencedRelation: "normalized_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_evaluations_normalized_service_id_fkey"
            columns: ["normalized_service_id"]
            isOneToOne: false
            referencedRelation: "normalized_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_evaluations_region_cluster_id_fkey"
            columns: ["region_cluster_id"]
            isOneToOne: false
            referencedRelation: "region_clusters"
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
      region_clusters: {
        Row: {
          area_type: string | null
          bundesland: string | null
          created_at: string | null
          id: string
          plz_prefix: string
          region_name: string | null
        }
        Insert: {
          area_type?: string | null
          bundesland?: string | null
          created_at?: string | null
          id?: string
          plz_prefix: string
          region_name?: string | null
        }
        Update: {
          area_type?: string | null
          bundesland?: string | null
          created_at?: string | null
          id?: string
          plz_prefix?: string
          region_name?: string | null
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          service_domain: string
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          service_domain: string
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          service_domain?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      text_normalizations: {
        Row: {
          cleaned_text: string
          confidence_score: number
          created_at: string | null
          id: string
          is_verified: boolean | null
          match_count: number | null
          normalized_material_id: string | null
          normalized_service_id: string | null
          position_type: string | null
          raw_text: string
          service_domain: string
          updated_at: string | null
        }
        Insert: {
          cleaned_text: string
          confidence_score: number
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          match_count?: number | null
          normalized_material_id?: string | null
          normalized_service_id?: string | null
          position_type?: string | null
          raw_text: string
          service_domain: string
          updated_at?: string | null
        }
        Update: {
          cleaned_text?: string
          confidence_score?: number
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          match_count?: number | null
          normalized_material_id?: string | null
          normalized_service_id?: string | null
          position_type?: string | null
          raw_text?: string
          service_domain?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "text_normalizations_normalized_material_id_fkey"
            columns: ["normalized_material_id"]
            isOneToOne: false
            referencedRelation: "normalized_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "text_normalizations_normalized_service_id_fkey"
            columns: ["normalized_service_id"]
            isOneToOne: false
            referencedRelation: "normalized_services"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_related_extensions: {
        Row: {
          created_at: string | null
          id: string
          labor_unit_price: number | null
          labor_units: number | null
          part_type: string | null
          position_id: string | null
          vehicle_class: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          labor_unit_price?: number | null
          labor_units?: number | null
          part_type?: string | null
          position_id?: string | null
          vehicle_class?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          labor_unit_price?: number | null
          labor_units?: number | null
          part_type?: string | null
          position_id?: string | null
          vehicle_class?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_related_extensions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "document_positions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonymize_text: { Args: { input_text: string }; Returns: string }
      generate_time_bucket: { Args: { d: string }; Returns: string }
      get_region_cluster_id: { Args: { plz: string }; Returns: string }
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
