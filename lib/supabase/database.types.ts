export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["properties"]["Insert"]>;
        Relationships: [];
      };
      staff_profiles: {
        Row: {
          id: string;
          auth_user_id: string | null;
          name: string;
          role: Database["public"]["Enums"]["staff_role"];
          avatar_url: string | null;
          on_shift: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          name: string;
          role: Database["public"]["Enums"]["staff_role"];
          avatar_url?: string | null;
          on_shift?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_profiles"]["Insert"]>;
        Relationships: [];
      };
      staff_property_memberships: {
        Row: {
          id: string;
          staff_id: string;
          auth_user_id: string | null;
          property_id: string;
          role: Database["public"]["Enums"]["staff_role"];
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          auth_user_id?: string | null;
          property_id: string;
          role: Database["public"]["Enums"]["staff_role"];
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_property_memberships"]["Insert"]>;
        Relationships: [];
      };
      guests: {
        Row: {
          id: string;
          property_id: string;
          first_name: string;
          last_name: string;
          preferred_name: string | null;
          pronouns: string | null;
          avatar_url: string | null;
          loyalty_tier: Database["public"]["Enums"]["loyalty_tier"];
          vip: boolean;
          languages: string[];
          home_city: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          property_id: string;
          first_name: string;
          last_name: string;
          preferred_name?: string | null;
          pronouns?: string | null;
          avatar_url?: string | null;
          loyalty_tier?: Database["public"]["Enums"]["loyalty_tier"];
          vip?: boolean;
          languages?: string[];
          home_city?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["guests"]["Insert"]>;
        Relationships: [];
      };
      guest_stays: {
        Row: {
          id: string;
          property_id: string;
          guest_id: string;
          arrival_date: string;
          departure_date: string;
          status: Database["public"]["Enums"]["guest_status"];
          room_number: string | null;
          room_type: string;
          party_size: number;
          occasion: Database["public"]["Enums"]["guest_occasion"] | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          property_id: string;
          guest_id: string;
          arrival_date: string;
          departure_date: string;
          status: Database["public"]["Enums"]["guest_status"];
          room_number?: string | null;
          room_type: string;
          party_size?: number;
          occasion?: Database["public"]["Enums"]["guest_occasion"] | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["guest_stays"]["Insert"]>;
        Relationships: [];
      };
      guest_tags: {
        Row: {
          id: string;
          property_id: string;
          guest_id: string;
          label: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          guest_id: string;
          label: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guest_tags"]["Insert"]>;
        Relationships: [];
      };
      guest_notes: {
        Row: {
          id: string;
          property_id: string;
          guest_id: string;
          body: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          property_id: string;
          guest_id: string;
          body: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["guest_notes"]["Insert"]>;
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          property_id: string;
          guest_id: string;
          stay_id: string | null;
          category: Database["public"]["Enums"]["ticket_category"];
          title: string;
          detail: string;
          priority: Database["public"]["Enums"]["ticket_priority"];
          status: Database["public"]["Enums"]["ticket_status"];
          created_at: string;
          updated_at: string;
          created_by: string | null;
          assigned_to_role: Database["public"]["Enums"]["staff_role"] | null;
          assigned_to_staff_id: string | null;
          due_at: string | null;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          property_id: string;
          guest_id: string;
          stay_id?: string | null;
          category: Database["public"]["Enums"]["ticket_category"];
          title: string;
          detail: string;
          priority: Database["public"]["Enums"]["ticket_priority"];
          status?: Database["public"]["Enums"]["ticket_status"];
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          assigned_to_role?: Database["public"]["Enums"]["staff_role"] | null;
          assigned_to_staff_id?: string | null;
          due_at?: string | null;
          archived_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tickets"]["Insert"]>;
        Relationships: [];
      };
      ticket_events: {
        Row: {
          id: string;
          property_id: string;
          ticket_id: string;
          type: Database["public"]["Enums"]["ticket_event_type"];
          actor_id: string | null;
          actor_name: string;
          body: string | null;
          audio_url: string | null;
          from_status: Database["public"]["Enums"]["ticket_status"] | null;
          to_status: Database["public"]["Enums"]["ticket_status"] | null;
          escalated_to: Database["public"]["Enums"]["staff_role"] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          ticket_id: string;
          type: Database["public"]["Enums"]["ticket_event_type"];
          actor_id?: string | null;
          actor_name: string;
          body?: string | null;
          audio_url?: string | null;
          from_status?: Database["public"]["Enums"]["ticket_status"] | null;
          to_status?: Database["public"]["Enums"]["ticket_status"] | null;
          escalated_to?: Database["public"]["Enums"]["staff_role"] | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ticket_events"]["Insert"]>;
        Relationships: [];
      };
      unfiled_voice_notes: {
        Row: {
          id: string;
          property_id: string;
          transcript: string;
          category: Database["public"]["Enums"]["ticket_category"];
          priority: Database["public"]["Enums"]["ticket_priority"];
          guest_id: string | null;
          ticket_id: string | null;
          created_by: string | null;
          filed_by: string | null;
          created_at: string;
          filed_at: string | null;
        };
        Insert: {
          id?: string;
          property_id: string;
          transcript: string;
          category: Database["public"]["Enums"]["ticket_category"];
          priority: Database["public"]["Enums"]["ticket_priority"];
          guest_id?: string | null;
          ticket_id?: string | null;
          created_by?: string | null;
          filed_by?: string | null;
          created_at?: string;
          filed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["unfiled_voice_notes"]["Insert"]>;
        Relationships: [];
      };
      voice_note_assets: {
        Row: {
          id: string;
          property_id: string;
          ticket_event_id: string | null;
          storage_bucket: string;
          storage_path: string;
          mime_type: string | null;
          duration_seconds: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          ticket_event_id?: string | null;
          storage_bucket?: string;
          storage_path: string;
          mime_type?: string | null;
          duration_seconds?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["voice_note_assets"]["Insert"]>;
        Relationships: [];
      };
      guest_preferences: {
        Row: {
          id: string;
          property_id: string;
          guest_id: string;
          category: Database["public"]["Enums"]["preference_category"];
          label: string;
          detail: string;
          confidence: number;
          status: Database["public"]["Enums"]["preference_status"];
          source_type: Database["public"]["Enums"]["preference_source_type"];
          embedding: string | null;
          created_at: string;
          updated_at: string;
          resolved_by: string | null;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          property_id: string;
          guest_id: string;
          category: Database["public"]["Enums"]["preference_category"];
          label: string;
          detail: string;
          confidence?: number;
          status?: Database["public"]["Enums"]["preference_status"];
          source_type: Database["public"]["Enums"]["preference_source_type"];
          embedding?: string | null;
          created_at?: string;
          updated_at?: string;
          resolved_by?: string | null;
          resolved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["guest_preferences"]["Insert"]>;
        Relationships: [];
      };
      guest_preference_evidence: {
        Row: {
          id: string;
          property_id: string;
          preference_id: string;
          ticket_id: string | null;
          ticket_event_id: string | null;
          guest_note_id: string | null;
          unfiled_voice_note_id: string | null;
          quote: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          preference_id: string;
          ticket_id?: string | null;
          ticket_event_id?: string | null;
          guest_note_id?: string | null;
          unfiled_voice_note_id?: string | null;
          quote?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guest_preference_evidence"]["Insert"]>;
        Relationships: [];
      };
      preference_recommendations: {
        Row: {
          id: string;
          property_id: string;
          guest_id: string;
          stay_id: string | null;
          title: string;
          rationale: string;
          confidence: number;
          status: Database["public"]["Enums"]["recommendation_status"];
          created_at: string;
          updated_at: string;
          resolved_by: string | null;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          property_id: string;
          guest_id: string;
          stay_id?: string | null;
          title: string;
          rationale: string;
          confidence?: number;
          status?: Database["public"]["Enums"]["recommendation_status"];
          created_at?: string;
          updated_at?: string;
          resolved_by?: string | null;
          resolved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["preference_recommendations"]["Insert"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          property_id: string;
          actor_id: string | null;
          action: string;
          entity_table: string;
          entity_id: string;
          before: Json | null;
          after: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          actor_id?: string | null;
          action: string;
          entity_table: string;
          entity_id: string;
          before?: Json | null;
          after?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      staff_role:
        | "concierge"
        | "front_desk"
        | "housekeeping_lead"
        | "fnb_captain"
        | "spa_supervisor"
        | "security_lead"
        | "manager";
      guest_status: "arriving_today" | "checked_in" | "in_house" | "departing_today" | "upcoming" | "checked_out";
      loyalty_tier: "Standard" | "Silver" | "Gold" | "Platinum" | "Founder";
      guest_occasion: "anniversary" | "birthday" | "honeymoon" | "business" | "leisure";
      ticket_category: "guest_relations" | "room" | "housekeeping" | "security" | "fnb" | "spa";
      ticket_priority: "low" | "medium" | "high" | "urgent";
      ticket_status: "open" | "in_progress" | "blocked" | "resolved" | "escalated";
      ticket_event_type: "created" | "status_changed" | "escalated" | "comment" | "voice_note" | "assigned";
      preference_category: "dining" | "room" | "wellness" | "service" | "accessibility" | "security" | "occasion";
      preference_status: "candidate" | "confirmed" | "dismissed";
      preference_source_type: "tag" | "note" | "ticket" | "voice_note" | "staff";
      recommendation_status: "pending" | "accepted" | "dismissed";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
