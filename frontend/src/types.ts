export interface JourneyEntry {
  id?: number;
  country: string;
  city: string;
  entry_time: string; // YYYY-MM-DD HH:MM or YYYY-MM-DDTHH:MM
  file_path?: string;
  file_name?: string;
  notes?: string;
  // Dynamic fields parsed/inferred on client
  startDate?: string;
  endDate?: string;
  durationDays?: number;
}

export interface Country {
  id: number;
  name: string;
}

export interface City {
  id: number;
  country_id: number;
  name: string;
}

export interface LimitSetting {
  id?: number;
  country: string;
  max_days: number;
  rolling_period_days: number;
}

export interface LimitAlert {
  id?: number;
  country: string;
  maxDays: number;
  rollingPeriod: number;
  daysSpentCurrentWindow: number;
  maxDaysSpentAnyWindow: number;
  peakWindowEnd: string;
  peakExceeded: boolean;
  status: 'safe' | 'warning' | 'exceeded';
  message: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
