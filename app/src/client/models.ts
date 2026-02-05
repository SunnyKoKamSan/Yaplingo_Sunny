export type User = {
  id: string;
  name: string;
  language: string;
  timezone: string;
  activity: Record<string, number>;
};
