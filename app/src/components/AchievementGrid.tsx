import React, { useCallback, useState } from "react";
import { Alert, FlatList, Modal, Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import {
  AwardIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CrownIcon,
  DiamondIcon,
  FlameIcon,
  FootprintsIcon,
  GemIcon,
  GraduationCapIcon,
  LockIcon,
  Mic2Icon,
  MicIcon,
  PlaneIcon,
  RocketIcon,
  StarIcon,
  TrophyIcon,
  UtensilsCrossedIcon,
  ZapIcon,
  type LucideIcon,
  CalendarIcon,
  PaletteIcon,
} from "lucide-react-native";
import tw from "twrnc";

import { useClaimAchievementMutation } from "~/client";
import type { AchievementResponse } from "~/client/models";

import Text from "./Text";
import Button from "./Button";


type BadgeConfig = {
  color: string;
  icon: LucideIcon;
};

const BADGE_CONFIG: Record<string, BadgeConfig> = {
  first_step:       { color: "#22C55E", icon: FootprintsIcon },
  bronze_mic:       { color: "#CD7F32", icon: MicIcon },
  silver_mic:       { color: "#9CA3AF", icon: Mic2Icon },
  gold_mic:         { color: "#F59E0B", icon: AwardIcon },
  platinum_mic:     { color: "#A78BFA", icon: CrownIcon },
  diamond_mic:      { color: "#06B6D4", icon: GemIcon },
  streak_5:         { color: "#F97316", icon: FlameIcon },
  streak_14:        { color: "#EF4444", icon: CalendarIcon },
  streak_30:        { color: "#8B5CF6", icon: ZapIcon },
  streak_100:       { color: "#EC4899", icon: RocketIcon },
  streak_365:       { color: "#FBBF24", icon: StarIcon },
  lesson_50:        { color: "#3B82F6", icon: BookOpenIcon },
  lesson_200:       { color: "#6366F1", icon: GraduationCapIcon },
  lesson_500:       { color: "#14B8A6", icon: TrophyIcon },
  diamond_food:     { color: "#22C55E", icon: UtensilsCrossedIcon },
  diamond_culture:  { color: "#8B5CF6", icon: PaletteIcon },
  diamond_travel:   { color: "#06B6D4", icon: PlaneIcon },
  diamond_business: { color: "#6366F1", icon: BriefcaseIcon },
};

const DEFAULT_BADGE: BadgeConfig = { color: "#9CA3AF", icon: AwardIcon };
const BADGE_SIZE = 72;
const GEM_REWARD = 15;


const FlyingGem = ({
  index,
  onComplete,
}: {
  index: number;
  onComplete: () => void;
}) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.3);

  const startX = (Math.random() - 0.5) * 60;

  React.useEffect(() => {
    translateX.value = withSequence(
      withTiming(startX, { duration: 100 }),
      withTiming(0, { duration: 600 }),
    );
    translateY.value = withDelay(
      index * 80,
      withTiming(-280, { duration: 800 }),
    );
    scale.value = withDelay(
      index * 80,
      withSequence(
        withSpring(1.2, { damping: 4 }),
        withTiming(0.5, { duration: 400 }),
      ),
    );
    opacity.value = withDelay(
      index * 80 + 500,
      withTiming(0, { duration: 300 }, () => {
        if (index === 0) runOnJS(onComplete)();
      }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: "absolute" }, style]}>
      <DiamondIcon size={20} color="#22C55E" fill="#22C55E" />
    </Animated.View>
  );
};


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
  const IconComponent = cfg.icon;
  const entering = item.unlocked
    ? ZoomIn.delay(index * 40).duration(250)
    : FadeIn.delay(index * 25).duration(200);

  const progressPct = Math.round(item.progress * 100);
  const isClaimable = !item.unlocked && progressPct >= 100;

  return (
    <Animated.View entering={entering} style={tw`flex-1 items-center py-2.5 px-1`}>
      <Pressable onPress={onPress} style={tw`items-center`}>
        {/* Outer ring */}
        <View
          style={[
            {
              width: BADGE_SIZE,
              height: BADGE_SIZE,
              borderRadius: BADGE_SIZE / 2,
              borderWidth: item.unlocked ? 3 : 2,
              borderColor: item.unlocked ? cfg.color : isClaimable ? "#22C55E" : "#D1D5DB",
              backgroundColor: item.unlocked
                ? cfg.color + "15"
                : isClaimable
                  ? "#22C55E10"
                  : "#F9FAFB",
              alignItems: "center",
              justifyContent: "center",
            },
            item.unlocked && {
              shadowColor: cfg.color,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4,
              shadowRadius: 10,
              elevation: 8,
            },
            isClaimable && {
              shadowColor: "#22C55E",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 6,
            },
          ]}
        >
          {item.unlocked ? (
            <IconComponent
              size={28}
              color={cfg.color}
              strokeWidth={2}
            />
          ) : isClaimable ? (
            <IconComponent
              size={28}
              color="#22C55E"
              strokeWidth={2}
            />
          ) : (
            <LockIcon size={22} color="#C4C4C4" strokeWidth={1.8} />
          )}
        </View>

        {/* Title */}
        <Text
          style={tw.style(
            "text-[11px] font-bold text-center mt-1.5",
            item.unlocked
              ? "text-zinc-800 dark:text-zinc-100"
              : isClaimable
                ? "text-green-600"
                : "text-zinc-400",
          )}
          numberOfLines={1}
        >
          {item.title}
        </Text>

        {/* Progress bar */}
        {!item.unlocked && (
          <View
            style={tw`w-14 h-1.5 rounded-full mt-1 overflow-hidden bg-zinc-200 dark:bg-zinc-700`}
          >
            <View
              style={[
                tw`h-full rounded-full`,
                {
                  width: `${progressPct}%`,
                  backgroundColor: isClaimable ? "#22C55E" : progressPct > 0 ? cfg.color : "transparent",
                },
              ]}
            />
          </View>
        )}

        {/* Status */}
        {item.unlocked ? (
          <View
            style={[
              tw`mt-1 rounded-full px-2 py-0.5`,
              { backgroundColor: cfg.color + "18" },
            ]}
          >
            <Text style={[tw`text-[9px] font-bold`, { color: cfg.color }]}>
              ✓ Earned
            </Text>
          </View>
        ) : isClaimable ? (
          <View style={tw`mt-1 rounded-full bg-green-500 px-2 py-0.5`}>
            <Text style={tw`text-[9px] font-bold text-white`}>Collect!</Text>
          </View>
        ) : progressPct > 0 ? (
          <Text style={tw`text-[9px] font-medium text-zinc-400 mt-1`}>
            {progressPct}%
          </Text>
        ) : (
          <Text style={tw`text-[9px] font-medium text-zinc-300 dark:text-zinc-600 mt-1`}>
            Locked
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
};


const DetailModal = ({
  item,
  onClose,
  onClaim,
  isClaiming,
}: {
  item: AchievementResponse | null;
  onClose: () => void;
  onClaim: (key: string) => void;
  isClaiming: boolean;
}) => {
  if (!item) return null;
  const cfg = BADGE_CONFIG[item.key] ?? DEFAULT_BADGE;
  const IconComponent = cfg.icon;
  const progressPct = Math.round(item.progress * 100);
  const isClaimable = !item.unlocked && progressPct >= 100;

  const getProgressMessage = () => {
    if (item.unlocked) {
      return `Earned ${new Date(item.unlocked_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    if (isClaimable) return "🎉 Achievement complete! Collect your reward!";
    if (progressPct >= 75) return "Almost there — just a little more!";
    if (progressPct >= 50) return "Halfway through — keep pushing!";
    if (progressPct > 0) return "Great start — keep it up!";
    return "Start practicing to make progress.";
  };

  // Flying gem state
  const [showGems, setShowGems] = useState(false);

  const handleClaim = () => {
    setShowGems(true);
    onClaim(item.key);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={tw`flex-1 items-center justify-center bg-black/50`}
        onPress={onClose}
      >
        <Pressable
          style={tw`mx-6 w-80 rounded-3xl bg-white dark:bg-zinc-900 p-6 items-center shadow-2xl`}
          onPress={() => {}}
        >
          {/* Badge */}
          <View
            style={[
              {
                width: 96,
                height: 96,
                borderRadius: 48,
                borderWidth: 3,
                borderColor: item.unlocked ? cfg.color : isClaimable ? "#22C55E" : "#D1D5DB",
                backgroundColor: item.unlocked
                  ? cfg.color + "15"
                  : isClaimable
                    ? "#22C55E10"
                    : "#F3F4F6",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              },
              (item.unlocked || isClaimable) && {
                shadowColor: item.unlocked ? cfg.color : "#22C55E",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
              },
            ]}
          >
            {item.unlocked || isClaimable ? (
              <IconComponent
                size={38}
                color={item.unlocked ? cfg.color : "#22C55E"}
                strokeWidth={1.8}
              />
            ) : (
              <LockIcon size={32} color="#C4C4C4" strokeWidth={1.5} />
            )}
          </View>

          {/* Flying gems overlay */}
          {showGems && (
            <View style={{ position: "absolute", top: 60, alignSelf: "center" }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <FlyingGem key={i} index={i} onComplete={() => setShowGems(false)} />
              ))}
            </View>
          )}

          <Text style={tw`text-xl font-bold text-center text-zinc-800 dark:text-zinc-100`}>
            {item.title}
          </Text>
          <Text style={tw`text-sm text-center text-zinc-500 mt-1`}>
            {item.desc}
          </Text>

          {/* Progress bar */}
          <View style={tw`w-full mt-4`}>
            <View style={tw`flex-row justify-between mb-1.5`}>
              <Text style={tw`text-xs font-medium text-zinc-400`}>Progress</Text>
              <Text
                style={[
                  tw`text-xs font-bold`,
                  { color: item.unlocked || isClaimable ? "#22C55E" : cfg.color },
                ]}
              >
                {progressPct}%
              </Text>
            </View>
            <View style={tw`h-2.5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800`}>
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

          <Text
            style={tw.style(
              "text-xs text-center mt-3 font-medium",
              item.unlocked ? "text-zinc-500" : isClaimable ? "text-green-600" : "text-zinc-400",
            )}
          >
            {getProgressMessage()}
          </Text>

          {/* Reward */}
          <View style={tw`flex-row items-center gap-1 mt-2`}>
            <Text style={tw`text-xs text-zinc-400`}>Reward:</Text>
            <DiamondIcon size={12} color="#22C55E" fill="#22C55E" />
            <Text style={tw`text-xs font-bold text-green-600`}>{GEM_REWARD} gems</Text>
          </View>

          {/* Action buttons */}
          {isClaimable ? (
            <Button
              onPress={handleClaim}
              disabled={isClaiming}
              style={tw`mt-4 px-8 bg-green-500 border-transparent`}
              shadowColor={tw.color("green-400")}
            >
              <View style={tw`flex-row items-center gap-1.5`}>
                <DiamondIcon size={16} color="white" fill="white" />
                <Text style={tw`text-sm font-bold text-white`}>
                  {isClaiming ? "Claiming..." : `Collect ${GEM_REWARD} 💎`}
                </Text>
              </View>
            </Button>
          ) : (
            <Button
              onPress={onClose}
              style={tw`mt-4 px-8 bg-zinc-100 dark:bg-zinc-800 border-transparent`}
            >
              <Text style={tw`text-sm font-bold text-zinc-600 dark:text-zinc-300`}>Close</Text>
            </Button>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};


export default function AchievementGrid({
  achievements,
}: {
  achievements: AchievementResponse[];
}) {
  const [selected, setSelected] = useState<AchievementResponse | null>(null);
  const claimMutation = useClaimAchievementMutation();

  const handleClaim = useCallback(
    (key: string) => {
      claimMutation.mutate(
        { achievement_key: key },
        {
          onSuccess: () => {
            setTimeout(() => setSelected(null), 1200);
          },
          onError: () => {
            Alert.alert("Error", "Could not claim achievement. Please try again.");
          },
        },
      );
    },
    [claimMutation],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: AchievementResponse; index: number }) => (
      <AchievementBadge item={item} index={index} onPress={() => setSelected(item)} />
    ),
    [],
  );

  const unlocked = achievements.filter((a) => a.unlocked).length;
  const claimable = achievements.filter((a) => !a.unlocked && a.progress >= 1.0).length;

  return (
    <>
      <View style={tw`flex-row items-center justify-between mb-2 px-1`}>
        <Text style={tw`text-xl font-bold text-zinc-800 dark:text-zinc-100`}>
          🏅 Achievements
        </Text>
        <View style={tw`flex-row items-center gap-2`}>
          {claimable > 0 && (
            <View style={tw`rounded-full bg-green-500 px-2 py-0.5`}>
              <Text style={tw`text-[10px] font-bold text-white`}>
                {claimable} to collect
              </Text>
            </View>
          )}
          <View style={tw`rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5`}>
            <Text style={tw`text-xs font-bold text-zinc-600 dark:text-zinc-300`}>
              {unlocked}/{achievements.length}
            </Text>
          </View>
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

      <DetailModal
        item={selected}
        onClose={() => setSelected(null)}
        onClaim={handleClaim}
        isClaiming={claimMutation.isPending}
      />
    </>
  );
}
