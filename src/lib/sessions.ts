// Todo: move all logic to this file instead.

export interface Session {
  id: string;
  title: string;
  duration: number;
  rating: number;
  comment: string;
  timestamp: number;
  state: "active" | "completed" | "aborted" | "paused" | "not_started";
}
