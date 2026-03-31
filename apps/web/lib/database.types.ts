export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          plan: "free" | "creator" | "pro";
          pipeline_version: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          plan?: "free" | "creator" | "pro";
          pipeline_version?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          plan?: "free" | "creator" | "pro";
          pipeline_version?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          filename: string;
          status: "uploading" | "processing" | "ready" | "done" | "failed";
          raw_url: string | null;
          processed_url: string | null;
          duration_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          filename: string;
          status?: "uploading" | "processing" | "ready" | "done" | "failed";
          raw_url?: string | null;
          processed_url?: string | null;
          duration_seconds?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          filename?: string;
          status?: "uploading" | "processing" | "ready" | "done" | "failed";
          raw_url?: string | null;
          processed_url?: string | null;
          duration_seconds?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      transcripts: {
        Row: {
          id: string;
          project_id: string;
          words: Json;
          srt: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          words: Json;
          srt?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          words?: Json;
          srt?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transcripts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      edit_steps: {
        Row: {
          id: string;
          project_id: string;
          steps: Json;
          approved_steps: Json | null;
          pipeline_log: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          steps: Json;
          approved_steps?: Json | null;
          pipeline_log?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          steps?: Json;
          approved_steps?: Json | null;
          pipeline_log?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "edit_steps_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      usage: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          export_minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          export_minutes: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string;
          export_minutes?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usage_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
