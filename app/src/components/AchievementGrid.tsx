import { useMemo, useState } from "react";
import { FlatList, Image, Modal, Pressable, View } from "react-native";
import { AwardIcon } from "lucide-react-native";
import tw from "twrnc";

import type { AchievementResponse } from "~/client";
import { BADGE_CONFIG, type BadgeConfig } from "~/config/badges";

import { Text } from "./primitives";

const BADGE_SIZE = 72;
const BADGE_ICON_SIZE = 32;
const MODAL_ICON_SIZE = 44;

const BadgeIcon = ({ cfg, size, dim = false }: { cfg?: BadgeConfig; size: number; dim?: boolean }) => {
  if (!cfg) {
    return <AwardIcon size={size} color="#9CA3AF" strokeWidth={2} opacity={dim ? 0.35 : 1} />;
  }
  const scaledSize = size * (cfg.iconScale ?? 1);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Image
        source={cfg.icon}
        resizeMode="contain"
        style={{ width: scaledSize, height: scaledSize, opacity: dim ? 0.35 : 1 }}
      />
    </View>
  );
};

type BadgeItemProps = {
  item: AchievementResponse;
  onPress: () => void;
};

const BadgeItem = ({ item, onPress }: BadgeItemProps) => {
  const cfg = BADGE_CONFIG[item.key];
  const progressPercent = Math.round(item.progress * 100);
  const claimable = !item.unlocked && progressPercent >= 100;
  const locked = !item.unlocked && !claimable;
  const borderColor = item.unlocked ? (cfg?.color ?? "#9CA3AF") : claimable ? "#22C55E" : "#D1D5DB";
  const backgroundColor = item.unlocked ? `${cfg?.color ?? "#9CA3AF"}15` : claimable ? "#22C55E10" : "#F9FAFB";

  return (
    <View style={tw`flex-1 items-center py-2.5 px-1`}>
      <Pressable onPress={onPress} style={tw`items-center`}>
        <View
          style={[
            {
              width: BADGE_SIZE,
              height: BADGE_SIZE,
              borderRadius: BADGE_SIZE / 2,
              borderWidth: item.unlocked ? 3 : 2,
              borderColor,
              backgroundColor,
              alignItems: "center",
              justifyContent: "center",
            },
            item.unlocked && {
              shadowColor: cfg?.color ?? "#9CA3AF",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 6,
            },
          ]}>
          <BadgeIcon cfg={cfg} size={BADGE_ICON_SIZE} dim={locked} />
        </View>
        <Text
          style={tw.style(
            "text-[11px] font-bold text-center mt-1.5",
            item.unlocked ? "text-zinc-800 dark:text-zinc-100" : claimable ? "text-green-600" : "text-zinc-400",
          )}
          numberOfLines={1}>
          {item.title}
        </Text>
        {!item.unlocked && (
          <View style={tw`w-14 h-1.5 rounded-full mt-1 overflow-hidden bg-zinc-200 dark:bg-zinc-700`}>
            <View
              style={[
                tw`h-full rounded-full`,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: claimable ? "#22C55E" : progressPercent > 0 ? (cfg?.color ?? "#9CA3AF") : "transparent",
                },
              ]}
            />
          </View>
        )}
        {item.unlocked ? (
          <View style={[tw`mt-1 rounded-full px-2 py-0.5`, { backgroundColor: `${cfg?.color ?? "#9CA3AF"}18` }]}>
            <Text style={[tw`text-[9px] font-bold`, { color: cfg?.color ?? "#9CA3AF" }]}>✓ Earned</Text>
          </View>
        ) : claimable ? (
          <View style={tw`mt-1 rounded-full bg-green-500 px-2 py-0.5`}>
            <Text style={tw`text-[9px] font-bold text-white`}>Collect!</Text>
          </View>
        ) : progressPercent > 0 ? (
          <Text style={tw`text-[9px] font-medium text-zinc-400 mt-1`}>{progressPercent}%</Text>
        ) : (
          <Text style={tw`text-[9px] font-medium text-zinc-300 dark:text-zinc-600 mt-1`}>Locked</Text>
        )}
      </Pressable>
    </View>
  );
};

type DetailModalProps = {
  item: AchievementResponse | null;
  claiming: boolean;
  onClose: () => void;
  onClaim: (achievementKey: string) => void;
};

const DetailModal = ({ item, claiming, onClose, onClaim }: DetailModalProps) => {
  if (!item) return null;

  const cfg = BADGE_CONFIG[item.key];
  const progressPercent = Math.round(item.progress * 100);
  const claimable = !item.unlocked && progressPercent >= 100;
  const locked = !item.unlocked && !claimable;
  const borderColor = item.unlocked ? (cfg?.color ?? "#9CA3AF") : claimable ? "#22C55E" : "#D1D5DB";
  const backgroundColor = item.unlocked ? `${cfg?.color ?? "#9CA3AF"}15` : claimable ? "#22C55E10" : "#F3F4F6";
  const statusText = item.unlocked
    ? `Earned ${item.unlocked_at ? new Date(item.unlocked_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}`
    : claimable
      ? "Achievement complete. Tap below to claim."
      : progressPercent >= 75
        ? "Almost there!"
        : progressPercent >= 50
          ? "Halfway there!"
          : progressPercent > 0
            ? "Keep going!"
            : "Start practicing to unlock this.";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={tw`flex-1 items-center justify-center bg-black/50`} onPress={onClose}>
        <Pressable style={tw`mx-6 w-80 rounded-3xl bg-white dark:bg-zinc-900 p-6 items-center shadow-2xl`} onPress={() => {}}>
          <View
            style={[
              {
                width: 96,
                height: 96,
                borderRadius: 48,
                borderWidth: 3,
                borderColor,
                backgroundColor,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              },
              (item.unlocked || claimable) && {
                shadowColor: item.unlocked ? (cfg?.color ?? "#9CA3AF") : "#22C55E",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 8,
              },
            ]}>
            <BadgeIcon cfg={cfg} size={MODAL_ICON_SIZE} dim={locked} />
          </View>
          <Text style={tw`text-xl font-bold text-center text-zinc-800 dark:text-zinc-100`}>{item.title}</Text>
          <Text style={tw`text-sm text-center text-zinc-500 mt-1`}>{item.desc}</Text>
          <View style={tw`w-full mt-4`}>
            <View style={tw`flex-row justify-between mb-1.5`}>
              <Text style={tw`text-xs font-medium text-zinc-400`}>Progress</Text>
              <Text style={[tw`text-xs font-bold`, { color: item.unlocked || claimable ? "#22C55E" : (cfg?.color ?? "#9CA3AF") }]}>
                {progressPercent}%
              </Text>
            </View>
            <View style={tw`h-2.5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800`}>
              <View
                style={[
                  tw`h-full rounded-full`,
                  { width: `${progressPercent}%`, backgroundColor: item.unlocked ? (cfg?.color ?? "#9CA3AF") : "#22C55E" },
                ]}
              />
            </View>
          </View>
          <Text
            style={tw.style(
              "text-xs text-center mt-3 font-medium",
              item.unlocked ? "text-zinc-500" : claimable ? "text-green-600" : "text-zinc-400",
            )}>
            {statusText}
          </Text>
          <Pressable
            onPress={claimable ? () => onClaim(item.key) : onClose}
            disabled={claimable && claiming}
            style={({ pressed }) => [
              tw`mt-4 px-8 py-3 rounded-full items-center justify-center`,
              {
                backgroundColor: "#FFF",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.08)",
                opacity: claiming ? 0.6 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}>
            <Text style={tw`text-sm font-bold ${claimable ? "text-green-600" : "text-zinc-600"}`}>
              {claimable ? (claiming ? "Claiming..." : "Claim") : "Close"}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default function AchievementGrid({
  achievements,
  onClaim,
  claimingKey,
}: {
  achievements: AchievementResponse[];
  onClaim: (achievementKey: string) => void;
  claimingKey?: string | null;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedItem = useMemo(
    () => achievements.find((item) => item.key === selectedKey) ?? null,
    [achievements, selectedKey],
  );
  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  const claimableCount = achievements.filter((item) => !item.unlocked && item.progress >= 1).length;
  const claimingSelected = !!selectedItem && claimingKey === selectedItem.key;

  const handleClaim = (achievementKey: string) => {
    onClaim(achievementKey);
  };

  const renderItem = ({ item }: { item: AchievementResponse }) => (
    <BadgeItem item={item} onPress={() => setSelectedKey(item.key)} />
  );

  return (
    <>
      <View style={tw`flex-row items-center justify-between px-1`}>
        <Text style={tw`text-xl font-bold text-zinc-800 dark:text-zinc-100`}>🏅 Achievements</Text>
        <View style={tw`flex-row items-center gap-2`}>
          {claimableCount > 0 && (
            <View style={tw`rounded-full bg-green-500 px-2 py-0.5`}>
              <Text style={tw`text-[10px] font-bold text-white`}>{claimableCount} to collect</Text>
            </View>
          )}
          <View style={tw`rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5`}>
            <Text style={tw`text-xs font-bold text-zinc-600 dark:text-zinc-300`}>
              {unlockedCount}/{achievements.length}
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
        item={selectedItem}
        claiming={claimingSelected}
        onClose={() => setSelectedKey(null)}
        onClaim={handleClaim}
      />
    </>
  );
}
