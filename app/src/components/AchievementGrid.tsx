import { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import tw from "twrnc";

import type { AchievementResponse } from "~/client/models";

import Text from "./Text";
import Button from "./Button";

// ── Badge visual config ──────────────────────────────────────────────────────

const BADGE_CONFIG: Record<string, { color: string; emoji: string }> = {
  // XP milestones
  first_step:       { color: "#22C55E", emoji: "👣" },
  bronze_mic:       { color: "#CD7F32", emoji: "🎤" },
  silver_mic:       { color: "#9CA3AF", emoji: "🎙️" },
  gold_mic:         { color: "#F59E0B", emoji: "🏅" },
  platinum_mic:     { color: "#A78BFA", emoji: "👑" },
  diamond_mic:      { color: "#06B6D4", emoji: "💎" },
  // Streak milestones
  streak_5:         { color: "#F97316", emoji: "🔥" },
  streak_14:        { color: "#EF4444", emoji: "📅" },
  streak_30:        { color: "#8B5CF6", emoji: "⚡" },
  streak_100:       { color: "#EC4899", emoji: "🚀" },
  streak_365:       { color: "#FBBF24", emoji: "⭐" },
  // Lesson milestones
  lesson_50:        { color: "#3B82F6", emoji: "📖" },
  lesson_200:       { color: "#6366F1", emoji: "🎓" },
  lesson_500:       { color: "#14B8A6", emoji: "🏆" },
  // Mastery
  diamond_food:     { color: "#22C55E", emoji: "🍜" },
  diamond_culture:  { color: "#8B5CF6", emoji: "🎭" },
  diamond_travel:   { color: "#06B6D4", emoji: "✈️" },
  diamond_business: { color: "#6366F1", emoji: "💼" },
};

const DEFAULT_BADGE = { color: "#9CA3AF", emoji: "🏅" };

const BADGE_SIZE = 68;

// ── Badge Component (inspired by reference: circular ring + emoji) ───────────

const AchievementBadge = ({
  item,
  index,
  onPress,
}: {
  item: AchievementResponse;
  index: number;
  onPress: () => void;
}) => {
  const cfg = BADGE_CONFIG[item.key] ?? DEFAULT_BADGE;
  const entering = item.unlocked
    ? ZoomIn.delay(index * 50).duration(300)
    : FadeIn.delay(index * 30).duration(200);

  const progressPct = Math.round(item.progress * 100);

  return (
    <Animated.View entering={entering} style={tw`flex-1 items-center py-2 px-1`}>
      <Pressable onPress={onPress} style={tw`items-center`}>
        {/* Circular badge */}
        <View
          style={[
            {
              width: BADGE_SIZE,
              height: BADGE_SIZE,
              borderRadius: BADGE_SIZE / 2,
              borderWidth: 3,
              borderColor: item.unlocked ? cfg.color : "#D1D5DB",
              backgroundColor: item.unlocked ? cfg.color + "18" : "#F3F4F6",
              alignItems: "center",
              justifyContent: "center",
              opacity: item.unlocked ? 1 : 0.45,
            },
            item.unlocked && {
              shadowColor: cfg.color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 6,
            },
          ]}
        >
          <Text style={{ fontSize: 28 }}>
            {item.unlocked ? cfg.emoji : "🔒"}
          </Text>
        </View>

        {/* Title */}
        <Text
          style={tw.style(
            "text-xs font-bold text-center mt-1.5",
            item.unlocked ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-400",
          )}
          numberOfLines={1}
        >
          {item.title}
        </Text>

        {/* Progress bar */}
        <View
          style={tw`w-14 h-1 rounded-full mt-1 overflow-hidden bg-zinc-200 dark:bg-zinc-700`}
        >
          <View
            style={[
              tw`h-full rounded-full`,
              {
                width: `${progressPct}%`,
                backgroundColor: item.unlocked ? cfg.color : progressPct > 0 ? "#22C55E" : "transparent",
              },
            ]}
          />
        </View>

        {/* Status pill */}
        {item.unlocked ? (
          <View
            style={[
              tw`mt-1 rounded-full px-2 py-0.5`,
              { backgroundColor: cfg.color + "20" },
            ]}
          >
            <Text style={[tw`text-[9px] font-bold`, { color: cfg.color }]}>
              ✓ Done
            </Text>
          </View>
        ) : progressPct > 0 ? (
          <Text style={tw`text-[9px] font-medium text-zinc-400 mt-1`}>
            {progressPct}%
          </Text>
        ) : (
          <Text style={tw`text-[9px] font-medium text-zinc-300 mt-1`}>
            Locked
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
};

// ── Detail Modal ─────────────────────────────────────────────────────────────

const DetailModal = ({
  item,
  onClose,
}: {
  item: AchievementResponse | null;
  onClose: () => void;
}) => {
  if (!item) return null;
  const cfg = BADGE_CONFIG[item.key] ?? DEFAULT_BADGE;
  const progressPct = Math.round(item.progress * 100);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={tw`flex-1 items-center justify-center bg-black/50`}
        onPress={onClose}
      >
        <Pressable
          style={tw`mx-8 w-72 rounded-3xl bg-white dark:bg-zinc-900 p-6 items-center shadow-xl`}
          onPress={() => {}}
        >
          {/* Badge circle */}
          <View
            style={[
              {
                width: 88,
                height: 88,
                borderRadius: 44,
                borderWidth: 4,
                borderColor: item.unlocked ? cfg.color : "#D1D5DB",
                backgroundColor: item.unlocked ? cfg.color + "18" : "#F3F4F6",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              },
              item.unlocked && {
                shadowColor: cfg.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
              },
            ]}
          >
            <Text style={{ fontSize: 38 }}>
              {item.unlocked ? cfg.emoji : "🔒"}
            </Text>
          </View>

          <Text style={tw`text-lg font-bold text-center text-zinc-800 dark:text-zinc-100`}>
            {item.title}
          </Text>
          <Text style={tw`text-sm text-center text-zinc-500 mt-1`}>
            {item.desc}
          </Text>

          {/* Progress bar */}
          <View style={tw`w-full mt-4`}>
            <View style={tw`flex-row justify-between mb-1`}>
              <Text style={tw`text-xs font-medium text-zinc-400`}>Progress</Text>
              <Text style={[tw`text-xs font-bold`, { color: item.unlocked ? cfg.color : "#22C55E" }]}>
                {progressPct}%
              </Text>
            </View>
            <View style={tw`h-2 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700`}>
              <View
                style={[
                  tw`h-full rounded-full`,
                  {
                    width: `${progressPct}%`,
                    backgroundColor: item.unlocked ? cfg.color : "#22C55E",
                  },
                ]}
              />
            </View>
          </View>

          <Text style={tw`text-xs text-center mt-3 font-medium text-green-600`}>
            {item.unlocked
              ? `Earned ${new Date(item.unlocked_at!).toLocaleDateString()}`
              : progressPct > 0
                ? "Keep going — you're making progress!"
                : "Keep practicing to unlock!"}
          </Text>

          {/* Gem reward note */}
          <View style={tw`flex-row items-center gap-1 mt-2`}>
            <Text style={tw`text-xs text-zinc-400`}>Reward:</Text>
            <Text style={tw`text-xs font-bold text-green-600`}>💎 15 gems</Text>
          </View>

          <Button
            onPress={onClose}
            style={tw`mt-4 px-6 bg-green-500 border-transparent`}
          >
            <Text style={tw`text-sm font-bold text-white`}>Close</Text>
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ── Grid ─────────────────────────────────────────────────────────────────────

export default function AchievementGrid({
  achievements,
}: {
  achievements: AchievementResponse[];
}) {
  const [selected, setSelected] = useState<AchievementResponse | null>(null);

  const renderItem = useCallback(
    ({ item, index }: { item: AchievementResponse; index: number }) => (
      <AchievementBadge item={item} index={index} onPress={() => setSelected(item)} />
    ),
    [],
  );

  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <>
      <View style={tw`flex-row items-center justify-between mb-2 px-1`}>
        <Text style={tw`text-xl font-bold text-zinc-800 dark:text-zinc-100`}>
          🏅 Achievements
        </Text>
        <View style={tw`rounded-full bg-green-100 dark:bg-green-900/40 px-2.5 py-0.5`}>
          <Text style={tw`text-xs font-bold text-green-700 dark:text-green-300`}>
            {unlocked}/{achievements.length}
          </Text>
        </View>
      </View>

      <FlatList
        data={achievements}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        numColumns={3}
        scrollEnabled={false}
        contentContainerStyle={tw`px-0.5`}
      />

      <DetailModal item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
