export interface Trip {
  id?: number;
  title: string;
  description: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
}

export interface Destination {
  id?: number;
  trip_id: number;
  country: string;
  city: string;
  entry_date: string; // YYYY-MM-DD
  exit_date: string;  // YYYY-MM-DD
}

export interface Receipt {
  id?: number;
  destination_id: number;
  file_path: string;
  file_name: string;
  location: string;
  timestamp: string;  // YYYY-MM-DD HH:MM
  amount?: number;
  currency?: string;
  notes?: string;
}

export interface LimitSetting {
  id?: number;
  country: string;
  max_days: number;
  rolling_period_days: number;
}

// Composite types for UI presentation and reporting
export interface DestinationWithReceipts extends Destination {
  receipts: Receipt[];
}

export interface TripWithDestinations extends Trip {
  destinations: DestinationWithReceipts[];
}

// LLM Interaction Types
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface LLMRequest {
  message: string;
  history?: Message[];
  model?: string; // Model name, e.g., 'ollama/llama3', 'gpt-4o', etc.
}

export interface LLMResponse {
  response: string;
}
