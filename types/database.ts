export type ThemeMode = "light" | "dark" | "excel";

export type Room = {
  id: string;
  title: string;
  created_at: string;
};

export type Message = {
  id: number;
  room_id: string;
  sender_name: string;
  content: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: Room;
        Insert: {
          id?: string;
          title: string;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          title: string;
          created_at: string;
        }>;
      };
      messages: {
        Row: Message;
        Insert: {
          id?: number;
          room_id: string;
          sender_name: string;
          content: string;
          created_at?: string;
        };
        Update: Partial<{
          id: number;
          room_id: string;
          sender_name: string;
          content: string;
          created_at: string;
        }>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
