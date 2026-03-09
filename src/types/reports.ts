export interface DailyReport {
  date: string;
  generated_at: string;
  agents_active: number;
  total_checkpoints: number;
  total_decisions: number;
  total_dead_ends: number;
  total_journal_entries: number;
  top_projects: Array<{ project: string; count: number }>;
  top_tags: Array<{ tag: string; count: number }>;
  highlights: {
    breakthroughs: Array<{ agent: string; text: string }>;
    critical_dead_ends: Array<{ agent: string; text: string }>;
    key_decisions: Array<{ agent: string; text: string }>;
  };
}

export interface WeeklyReport {
  week: string;
  start_date: string;
  end_date: string;
  generated_at: string;
  agents_active: number;
  daily_breakdown: Array<{
    date: string;
    checkpoints: number;
    decisions: number;
    dead_ends: number;
  }>;
  total_checkpoints: number;
  total_decisions: number;
  total_dead_ends: number;
  total_journal_entries: number;
  top_projects: Array<{ project: string; count: number }>;
  highlights: {
    breakthroughs: Array<{ agent: string; text: string }>;
    critical_dead_ends: Array<{ agent: string; text: string }>;
    key_decisions: Array<{ agent: string; text: string }>;
  };
}
