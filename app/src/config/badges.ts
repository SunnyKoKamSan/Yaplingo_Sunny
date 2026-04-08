import type { ImageSourcePropType } from "react-native";

export type BadgeConfig = {
  color: string;
  icon: ImageSourcePropType;
  iconScale?: number;
};

export const BADGE_CONFIG: Record<string, BadgeConfig> = {
  first_step: { color: "#22C55E", icon: require("@/icons/achievements/firststep.png") },
  bronze_mic: { color: "#CD7F32", icon: require("@/icons/achievements/bronzemic.png"), iconScale: 1.45 },
  silver_mic: { color: "#9CA3AF", icon: require("@/icons/achievements/silvermic.png"), iconScale: 1.45 },
  gold_mic: { color: "#F59E0B", icon: require("@/icons/achievements/goldmic.png"), iconScale: 1.45 },
  platinum_mic: { color: "#A78BFA", icon: require("@/icons/achievements/platinummic.png"), iconScale: 1.45 },
  diamond_mic: { color: "#06B6D4", icon: require("@/icons/achievements/diamondmic.png"), iconScale: 1.45 },
  streak_5: { color: "#F97316", icon: require("@/icons/achievements/onfire.png") },
  streak_14: { color: "#EF4444", icon: require("@/icons/achievements/2weeks.png") },
  streak_30: { color: "#8B5CF6", icon: require("@/icons/achievements/unstoppable.png") },
  streak_100: { color: "#EC4899", icon: require("@/icons/achievements/century.png") },
  streak_365: { color: "#FBBF24", icon: require("@/icons/achievements/yearofyap.png") },
  lesson_50: { color: "#3B82F6", icon: require("@/icons/achievements/halfcentury.png") },
  lesson_200: { color: "#6366F1", icon: require("@/icons/achievements/dedicated.png") },
  lesson_500: { color: "#14B8A6", icon: require("@/icons/achievements/lessonlegend.png") },
  weekly_champ: { color: "#F59E0B", icon: require("@/icons/achievements/weeklychampion.png") },
  alltime_legend: { color: "#FFD700", icon: require("@/icons/achievements/alltimelegend.png") },
};
