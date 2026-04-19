import React, { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Image, Modal, Pressable, View, type ImageSourcePropType } from "react-native";
import { useTheme } from "@react-navigation/native";
import { BanknoteIcon, GemIcon, RocketIcon, ShieldIcon, type LucideIcon } from "lucide-react-native";
import tw from "twrnc";

import {
  useAchievementsQuery,
  useClaimAchievementMutation,
  useCurrentUserQuery,
  usePurchaseShopItemMutation,
  useShopItemsQuery,
  type Achievement,
  type ShopItem,
} from "~/client";
import { Button, Spinner, Text } from "~/components/primitives";
import { useSetNavigationOptions } from "~/hooks";
import { formatCompactNumber } from "~/utils";

import { ActiveCard } from ".";

const ACHIEVEMENT_BADGES: Record<
  string,
  {
    color: string;
    icon: ImageSourcePropType;
    iconScale?: number;
  }
> = {
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
  session_50: { color: "#3B82F6", icon: require("@/icons/achievements/halfcentury.png") },
  session_200: { color: "#6366F1", icon: require("@/icons/achievements/dedicated.png") },
  session_500: { color: "#14B8A6", icon: require("@/icons/achievements/lessonlegend.png") },
  alltime_legend: { color: "#FFD700", icon: require("@/icons/achievements/alltimelegend.png") },
};

const AchievementBadgeIcon = ({
  badge,
  size,
  dim,
}: {
  badge: (typeof ACHIEVEMENT_BADGES)[string];
  size: number;
  dim: boolean;
}) => {
  size = size * (badge.iconScale ?? 1);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Image source={badge.icon} resizeMode="contain" style={{ width: size, height: size, opacity: dim ? 0.5 : 1 }} />
    </View>
  );
};

const AchievementListItem = ({ item, onPress }: { item: Achievement; onPress: () => void }) => {
  const badge = ACHIEVEMENT_BADGES[item.key];
  const progress = Math.round(item.progress * 100);
  const claimable = !item.claimed_at && item.progress >= 1.0;
  return (
    <View style={tw`flex-1 items-center px-1 py-2.5`}>
      <Pressable onPress={onPress} style={tw`items-center gap-1.5`}>
        <View
          style={[
            tw.style(
              `size-18 items-center justify-center rounded-full border-2`,
              item.progress >= 1.0 ? "border-green-500" : "border-zinc-500/50",
            ),
          ]}>
          <AchievementBadgeIcon badge={badge} size={32} dim={item.progress < 1.0} />
        </View>
        <Text style={tw.style("text-center text-base font-bold", item.progress >= 1.0 && "text-green-500")}>
          {item.title}
        </Text>
        {!item.claimed_at && (
          <View style={tw`h-1.5 w-20 overflow-hidden rounded-full bg-zinc-500/25`}>
            <View
              style={[
                tw`h-full rounded-full`,
                {
                  width: `${progress}%`,
                  backgroundColor: progress >= 1.0 ? tw.color("green-500") : badge.color,
                },
              ]}
            />
          </View>
        )}
        {item.claimed_at ? (
          <View style={tw`mt-1 rounded-full bg-green-500/25 px-3 py-1`}>
            <Text style={tw`text-sm font-medium text-green-500`}>✓ Claimed</Text>
          </View>
        ) : claimable ? (
          <View style={tw`mt-1 rounded-full bg-green-500 px-3 py-1`}>
            <Text style={tw`text-sm font-medium text-white`}>Claim</Text>
          </View>
        ) : (
          <Text style={tw`text-base font-medium text-neutral-500`}>{progress > 0 ? `${progress}%` : "Locked"}</Text>
        )}
      </Pressable>
    </View>
  );
};

const AchievementDetailModal = ({ item, onClose }: { item: Achievement; onClose: () => void }) => {
  const theme = useTheme();

  const mutateClaimAchievement = useClaimAchievementMutation();

  const badge = ACHIEVEMENT_BADGES[item.key];
  const progress = Math.round(item.progress * 100);
  const claimable = !item.claimed_at && progress >= 100;

  const claimedAt = item.claimed_at
    ? new Date(item.claimed_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const statusText = item.claimed_at
    ? `Claimed ${claimedAt}`
    : claimable
      ? "Completed!"
      : progress >= 75
        ? "Almost there!"
        : progress >= 50
          ? "Halfway there!"
          : progress > 0
            ? "Keep going!"
            : "Practice to unlock!";

  const handleClaim = useCallback(() => {
    mutateClaimAchievement.mutate(
      { key: item.key },
      { onError: () => Alert.alert("Claim Failed", "Something went wrong.") },
    );
  }, [mutateClaimAchievement, item.key]);

  return (
    <Modal visible={true} transparent={true} animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={tw`flex-1 items-center justify-center bg-black/50`}
        disabled={mutateClaimAchievement.isPending}
        onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[
            tw`mx-6 w-80 items-center justify-center gap-1 rounded-3xl p-6 shadow-2xl`,
            { backgroundColor: theme.colors.background },
          ]}>
          <View
            style={[
              tw.style(
                "size-24 items-center justify-center rounded-full border-2",
                item.progress >= 1.0 ? { borderColor: badge.color } : "border-zinc-500/50",
              ),
            ]}>
            <AchievementBadgeIcon badge={badge} size={46} dim={item.progress < 1.0} />
          </View>
          <Text style={tw`text-center text-xl font-bold`}>{item.title}</Text>
          <Text style={tw`text-center text-sm font-medium text-neutral-500`}>{item.description}</Text>
          <View style={tw`w-full gap-1.5`}>
            <View style={tw`flex-row justify-between`}>
              <Text style={tw`text-xs font-medium text-neutral-500`}>Progress</Text>
              <Text style={[tw`text-xs font-bold text-neutral-500`]}>{progress}%</Text>
            </View>
            <View style={tw`h-2.5 overflow-hidden rounded-full bg-zinc-500/25`}>
              <View
                style={[
                  tw`h-full rounded-full`,
                  {
                    width: `${progress}%`,
                    backgroundColor: claimable ? tw.color("green-500") : progress > 0 ? badge.color : "transparent",
                  },
                ]}
              />
            </View>
          </View>
          <Text
            style={tw.style(
              "mt-4 text-center text-sm font-medium",
              item.progress >= 1.0 ? "text-green-500" : "text-neutral-500",
            )}>
            {statusText}
          </Text>
          {claimable && (
            <Pressable
              onPress={handleClaim}
              disabled={mutateClaimAchievement.isPending}
              style={({ pressed }) => [
                tw`mt-4 items-center justify-center rounded-full bg-green-500 px-8 py-2`,
                {
                  opacity: mutateClaimAchievement.isPending ? 0.6 : 1,
                  transform: [{ scale: pressed ? 0.9 : 1 }],
                },
              ]}>
              <Text style={tw.style("text-sm font-bold text-white")}>
                {mutateClaimAchievement.isPending ? "Claiming..." : "Claim"}
              </Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const SHOP_ITEM_ICONS: Record<string, { color: string; icon: LucideIcon }> = {
  instant_points: { color: tw.color("sky-500")!, icon: BanknoteIcon },
  streak_freeze: { color: tw.color("blue-500")!, icon: ShieldIcon },
  boost_2x: { color: tw.color("lime-500")!, icon: RocketIcon },
  boost_5x: { color: tw.color("violet-500")!, icon: RocketIcon },
};

const GemShopModal = ({ onClose }: { onClose: () => void }) => {
  const theme = useTheme();

  const { data: user } = useCurrentUserQuery();
  const { data: items, ...query } = useShopItemsQuery();
  const mutationPurchaseShopItem = usePurchaseShopItemMutation();

  const handlePurchase = (item: ShopItem) => {
    mutationPurchaseShopItem.mutate(
      { key: item.key },
      {
        onSuccess: () => Alert.alert("Purchase Successful", `You have purchased ${item.name}!`),
        onError: () => Alert.alert("Purchase Failed", "Something went wrong."),
      },
    );
  };

  return (
    <Modal visible={true} transparent={true} animationType="fade" onRequestClose={onClose}>
      <Pressable style={tw`flex-1 items-center justify-center bg-black/50`} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[
            tw`mx-8 items-center justify-center rounded-3xl p-4 shadow-2xl`,
            { backgroundColor: theme.colors.background },
          ]}>
          {query.isPending && <Spinner size={32} />}
          {query.isSuccess && (
            <View style={tw`w-full gap-8`}>
              <View style={tw`flex-row items-center justify-between`}>
                <Text style={tw`text-2xl font-bold`}>GEM SHOP</Text>
                <View style={tw`flex-row items-center gap-1.5 rounded-full bg-indigo-500/50 px-2.5 py-0.5`}>
                  <GemIcon size={14} color={tw.color("indigo-500")} fill={tw.color("indigo-500")} />
                  <Text style={tw`text-base font-bold tracking-tighter text-indigo-500`}>
                    {user ? formatCompactNumber(user.gems) : "-"}
                  </Text>
                </View>
              </View>
              <View style={tw`gap-2`}>
                {items?.map((item) => {
                  const Icon = SHOP_ITEM_ICONS[item.key].icon;
                  return (
                    <View
                      key={item.key}
                      style={tw`flex-row items-center gap-2 rounded-xl border-2 border-zinc-500/50 px-2.5 py-2`}>
                      <View
                        style={[
                          tw`size-10 items-center justify-center rounded-full`,
                          { backgroundColor: `${SHOP_ITEM_ICONS[item.key].color}25` },
                        ]}>
                        <Icon size={20} color={SHOP_ITEM_ICONS[item.key].color} />
                      </View>
                      <View>
                        <Text style={tw`text-base font-medium`}>{item.name}</Text>
                        <Text style={tw`text-sm font-medium text-neutral-500`}>{item.description}</Text>
                      </View>
                      <Button
                        onPress={() => handlePurchase(item)}
                        disabled={!item.purchasable}
                        style={tw`w-18 ml-auto flex-row items-center justify-center gap-1 px-2`}>
                        <GemIcon size={14} color={tw.color("indigo-500")} />
                        <Text style={tw`text-sm font-bold`}>{item.price}</Text>
                      </Button>
                    </View>
                  );
                })}
              </View>
              <ActiveCard user={user} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const GemShopCard = () => {
  const theme = useTheme();

  const { data: user } = useCurrentUserQuery();

  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setExpanded(true)}
        style={[
          tw`absolute inset-x-2 bottom-2 flex-row items-center gap-2.5 rounded-2xl border-2 border-zinc-500/50 p-2`,
          { backgroundColor: theme.colors.card },
        ]}>
        <View style={tw`size-12 items-center justify-center rounded-xl bg-indigo-500/25`}>
          <Image source={require("@/icons/gem.png")} style={tw`size-10`} />
        </View>
        <View style={tw`grow flex-row items-center justify-between`}>
          <View>
            <Text style={tw`text-lg font-bold`}>Gem Shop</Text>
            <Text style={tw`text-sm font-medium text-neutral-500`}>Purchase XP boosts and streak freezes!</Text>
          </View>
          <View style={tw`flex-row items-center gap-1.5 rounded-full bg-indigo-500/50 px-2.5 py-0.5`}>
            <GemIcon size={14} color={tw.color("indigo-500")} fill={tw.color("indigo-500")} />
            <Text style={tw`text-base font-bold tracking-tighter text-indigo-500`}>
              {user ? formatCompactNumber(user.gems) : "-"}
            </Text>
          </View>
        </View>
      </Pressable>
      {expanded && <GemShopModal onClose={() => setExpanded(false)} />}
    </>
  );
};

export default function MainAchievementsScreen() {
  const { data: achievements = [] } = useAchievementsQuery();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedItem = useMemo(
    () => achievements.find((item) => item.key === selectedKey) ?? null,
    [achievements, selectedKey],
  );

  const claimedCount = achievements.filter((item) => item.claimed_at).length;
  const claimableCount = achievements.filter((item) => !item.claimed_at && item.progress >= 1.0).length;

  useSetNavigationOptions({
    headerLeft: () =>
      claimableCount > 0 && (
        <Text style={tw`px-2 text-center text-sm font-medium text-amber-500`}>{claimableCount} claimable</Text>
      ),
    headerRight: () => (
      <View style={tw`flex-row items-center justify-end gap-2 px-2`}>
        <View style={tw`rounded-full bg-zinc-500/50 px-2.5 py-0.5`}>
          <Text style={tw`text-sm font-medium text-white`}>
            {claimedCount}/{achievements.length}
          </Text>
        </View>
      </View>
    ),
  });

  return (
    <>
      <FlatList
        data={achievements}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <AchievementListItem item={item} onPress={() => setSelectedKey(item.key)} />}
        alwaysBounceVertical={false}
        numColumns={3}
        contentContainerStyle={tw`gap-2 py-4 pb-24`}
      />
      <GemShopCard />
      {selectedItem && <AchievementDetailModal item={selectedItem} onClose={() => setSelectedKey(null)} />}
    </>
  );
}
