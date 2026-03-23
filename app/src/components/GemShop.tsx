import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import {
  ShieldIcon,
  XIcon,
  ZapIcon,
  RocketIcon,
  ArrowUpCircleIcon,
  PlayCircleIcon,
  DiamondIcon,
  type LucideIcon,
} from "lucide-react-native";
import { useAtomValue } from "jotai";
import tw from "twrnc";

import { useGemConfigQuery, useInventoryQuery, useSpendGemsMutation, useUseSkillMutation, useActiveEventsQuery } from "~/client";
import { $gemBalance } from "~/store";

import Text from "./Text";

type ShopItem = {
  key: string;
  title: string;
  description: string;
  fallbackCost: number;
  icon: LucideIcon;
  color: string;
  gradientColors: [string, string];
  inventoryKey?: string;
  inventoryLabel?: (count: number) => string;
};

const SHOP_ITEMS: ShopItem[] = [
  {
    key: "streak_freeze",
    title: "Streak Freeze",
    description: "Protect your streak for 1 missed day",
    fallbackCost: 50,
    icon: ShieldIcon,
    color: "#3B82F6",
    gradientColors: ["#3B82F6", "#1D4ED8"],
    inventoryKey: "streak_freezes",
    inventoryLabel: (c) => `${c} freeze${c !== 1 ? "s" : ""} stored`,
  },
  {
    key: "xp_boost_1h",
    title: "2× XP Boost",
    description: "Double XP for the next hour",
    fallbackCost: 100,
    icon: ZapIcon,
    color: "#F97316",
    gradientColors: ["#F97316", "#EA580C"],
  },
  {
    key: "buy_xp_500",
    title: "Buy 500 XP",
    description: "Instantly add 500 XP to your total",
    fallbackCost: 50,
    icon: ArrowUpCircleIcon,
    color: "#22C55E",
    gradientColors: ["#22C55E", "#16A34A"],
  },
  {
    key: "xp_boost_30m_30x",
    title: "30× XP Mega Boost",
    description: "30× XP for 30 minutes — go big!",
    fallbackCost: 500,
    icon: RocketIcon,
    color: "#8B5CF6",
    gradientColors: ["#8B5CF6", "#7C3AED"],
  },
];

const hasTimezone = (value: string): boolean =>
  /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value);

const parseServerUtcMs = (value: string): number => {
  const normalized = hasTimezone(value) ? value : `${value}Z`;
  return new Date(normalized).getTime();
};

const getSecondsLeft = (endsAt: string, nowMs: number): number => {
  const endMs = parseServerUtcMs(endsAt);
  if (!Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - nowMs) / 1000));
};

const formatCountdown = (secondsLeft: number): string => {
  const hrs = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  if (hrs > 0) return `${hrs}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
};

const ShopItemCard = ({
  item,
  cost,
  canAfford,
  inventoryCount,
  onBuy,
}: {
  item: ShopItem;
  cost: number;
  canAfford: boolean;
  inventoryCount?: number;
  onBuy: () => void;
}) => {
  const IconComponent = item.icon;

  return (
    <Pressable
      onPress={canAfford ? onBuy : undefined}
      style={({ pressed }) => [
        tw`flex-row items-center py-3.5 px-1 gap-3`,
        {
          opacity: pressed && canAfford ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={[
          tw`w-11 h-11 rounded-full items-center justify-center`,
          { backgroundColor: `${item.color}15` },
        ]}
      >
        <IconComponent size={22} color={item.color} strokeWidth={2} />
      </View>
      <View style={tw`flex-1`}>
        <Text style={tw`text-[15px] font-semibold text-zinc-900 dark:text-zinc-100`}>
          {item.title}
        </Text>
        <Text style={tw`text-[13px] text-zinc-500 mt-0.5`}>{item.description}</Text>
        {item.inventoryLabel && inventoryCount != null && inventoryCount > 0 && (
          <Text style={[tw`text-[11px] font-medium mt-0.5`, { color: item.color }]}>
            {item.inventoryLabel(inventoryCount)}
          </Text>
        )}
      </View>
      {/* Light realistic pill button */}
      <Pressable
        onPress={canAfford ? onBuy : undefined}
        disabled={!canAfford}
        style={({ pressed }) => [
          tw`flex-row items-center gap-1.5 px-4 py-2.5 rounded-full`,
          {
            backgroundColor: canAfford ? "#FFFFFF" : "#F5F5F5",
            borderWidth: 1,
            borderColor: canAfford ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.04)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: canAfford ? 0.08 : 0.03,
            shadowRadius: 4,
            elevation: canAfford ? 3 : 1,
            borderTopColor: canAfford ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
            borderTopWidth: 1.5,
            transform: [{ scale: pressed && canAfford ? 0.96 : 1 }],
            opacity: canAfford ? 1 : 0.5,
          },
        ]}
      >
        <DiamondIcon size={13} color={canAfford ? item.color : "#9CA3AF"} fill={canAfford ? item.color : "#9CA3AF"} strokeWidth={0} />
        <Text style={[tw`text-[13px] font-semibold`, { color: canAfford ? item.color : "#9CA3AF" }]}>{cost}</Text>
      </Pressable>
    </Pressable>
  );
};

const ActiveBoostCard = ({ event, secondsLeft }: { event: { id: number; multiplier: number; name: string }; secondsLeft: number }) => {
  const boostColor = event.multiplier >= 10 ? "#8B5CF6" : "#F97316";

  return (
    <View style={tw`flex-row items-center py-3.5 px-1 gap-3`}>
      <View
        style={[
          tw`w-11 h-11 rounded-full items-center justify-center`,
          { backgroundColor: `${boostColor}15` },
        ]}
      >
        <ZapIcon size={22} color={boostColor} fill={boostColor} strokeWidth={0} />
      </View>
      <View style={tw`flex-1`}>
        <View style={tw`flex-row items-center gap-2`}>
          <Text style={tw`text-[15px] font-semibold text-zinc-900 dark:text-zinc-100`}>
            {event.multiplier}× XP Boost
          </Text>
          <View style={[tw`px-1.5 py-0.5 rounded`, { backgroundColor: `${boostColor}20` }]}>
            <Text style={[tw`text-[10px] font-bold`, { color: boostColor }]}>ACTIVE</Text>
          </View>
        </View>
        <Text style={tw`text-[13px] text-zinc-500 mt-0.5`}>
          {formatCountdown(secondsLeft)} remaining
        </Text>
      </View>
    </View>
  );
};

export default function GemShop({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const balance = useAtomValue($gemBalance);
  const spendMutation = useSpendGemsMutation();
  const useSkillMutation = useUseSkillMutation();
  const { data: inventory } = useInventoryQuery();
  const { data: gemConfig } = useGemConfigQuery();
  const { data: activeEvents = [] } = useActiveEventsQuery();
  const [purchasing, setPurchasing] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [now, setNow] = useState(Date.now());
  const toastOpacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tick every second for countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const showToast = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToastMsg(msg);
    toastOpacity.value = withTiming(1, { duration: 200 });
    timerRef.current = setTimeout(() => {
      toastOpacity.value = withTiming(0, { duration: 400 });
    }, 2000);
  }, [toastOpacity]);

  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: toastOpacity.value === 0 ? 8 : 0 }],
  }));

  const getCost = useCallback(
    (item: ShopItem): number =>
      gemConfig?.spend_rates[item.key] ?? item.fallbackCost,
    [gemConfig],
  );

  const getInventoryCount = (item: ShopItem): number | undefined => {
    if (!inventory || !item.inventoryKey) return undefined;
    const val = (inventory as Record<string, unknown>)[item.inventoryKey];
    if (typeof val === "boolean") return val ? 1 : 0;
    if (typeof val === "number") return val;
    return undefined;
  };

  const handleBuy = useCallback(
    (item: ShopItem) => {
      const cost = getCost(item);
      Alert.alert(
        "Confirm Purchase",
        `Spend ${cost} 💎 on ${item.title}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Buy",
            onPress: async () => {
              setPurchasing(true);
              try {
                const result = await spendMutation.mutateAsync({ item_key: item.key });
                const gainText = result.xp_added > 0 ? ` +${result.xp_added} XP` : "";
                showToast(`✨ ${item.title} purchased${gainText}`);
              } catch (error) {
                const message =
                  error instanceof Error && error.message
                    ? error.message
                    : "Could not complete purchase. Check your gem balance.";
                Alert.alert("Purchase Failed", message);
              } finally {
                setPurchasing(false);
              }
            },
          },
        ],
      );
    },
    [spendMutation, getCost, showToast],
  );

  const handleUseSkill = useCallback(
    async (item: ShopItem) => {
      try {
        const res = await useSkillMutation.mutateAsync(item.key);
        showToast(`🛡️ ${item.title}: ${res.message}`);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "No items available or activation failed.";
        Alert.alert("Cannot Use", message);
      }
    },
    [useSkillMutation, showToast],
  );

  if (!visible) return null;

  const streakFreezeCount = inventory?.streak_freezes ?? 0;
  const inventoryItems = SHOP_ITEMS.filter((item) => item.inventoryKey !== undefined);

  // Active XP boosts — parse server UTC safely so countdown remains correct on all devices.
  const liveBoosts = activeEvents
    .map((event) => ({
      event,
      secondsLeft: getSecondsLeft(event.ends_at, now),
    }))
    .filter(({ secondsLeft }) => secondsLeft > 0)
    .sort((a, b) => b.event.multiplier - a.event.multiplier || a.secondsLeft - b.secondsLeft);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={tw`flex-1 justify-end bg-black/40`}
      >
        <Pressable style={tw`flex-1`} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(300)}
          exiting={SlideOutDown.duration(250)}
          style={tw`bg-white dark:bg-zinc-900 rounded-t-[24px] pt-3 pb-10 shadow-2xl max-h-[85%]`}
        >
          {/* Handle bar */}
          <View style={tw`items-center mb-3`}>
            <View style={tw`w-9 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600`} />
          </View>

          {/* Clean Header */}
          <View style={tw`flex-row items-center justify-between px-5 mb-4`}>
            <Text style={tw`text-xl font-bold text-zinc-900 dark:text-zinc-100`}>Gem Shop</Text>
            <View style={tw`flex-row items-center gap-3`}>
              <View style={tw`flex-row items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full`}>
                <DiamondIcon size={14} color="#22C55E" fill="#22C55E" strokeWidth={0} />
                <Text style={tw`text-sm font-bold text-zinc-700 dark:text-zinc-300`}>
                  {balance.toLocaleString()}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={tw`w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 items-center justify-center`}
              >
                <XIcon size={18} color={tw.color("zinc-500")} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          {/* Toast */}
          {!!toastMsg && (
            <Animated.View
              style={[
                toastStyle,
                tw`absolute left-4 right-4 z-50 bg-zinc-900 dark:bg-zinc-100 rounded-xl px-4 py-3 items-center`,
                { top: 80 },
              ]}
              pointerEvents="none"
            >
              <Text style={tw`text-white dark:text-zinc-900 text-sm font-medium text-center`}>{toastMsg}</Text>
            </Animated.View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`px-5 pb-4`}>
            {/* Shop Items - clean list */}
            <View style={tw`bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl overflow-hidden`}>
              {SHOP_ITEMS.map((item, index) => {
                const cost = getCost(item);
                return (
                  <View key={item.key}>
                    <ShopItemCard
                      item={item}
                      cost={cost}
                      canAfford={balance >= cost && !purchasing}
                      inventoryCount={getInventoryCount(item)}
                      onBuy={() => handleBuy(item)}
                    />
                    {index < SHOP_ITEMS.length - 1 && (
                      <View style={tw`h-px bg-zinc-200 dark:bg-zinc-700 ml-16`} />
                    )}
                  </View>
                );
              })}
            </View>

            {/* My Skills section */}
            <Text style={tw`text-[13px] font-semibold text-zinc-400 uppercase tracking-wide mt-6 mb-2 ml-1`}>
              My Skills
            </Text>

            <View style={tw`bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl overflow-hidden`}>
              {/* Active XP boosts */}
              {liveBoosts.length > 0 ? (
                liveBoosts.map(({ event, secondsLeft }, index) => (
                  <View key={event.id}>
                    <ActiveBoostCard event={event} secondsLeft={secondsLeft} />
                    {(index < liveBoosts.length - 1 || inventoryItems.length > 0) && (
                      <View style={tw`h-px bg-zinc-200 dark:bg-zinc-700 ml-16`} />
                    )}
                  </View>
                ))
              ) : (
                <View style={tw`flex-row items-center py-3.5 px-1 gap-3`}>
                  <View style={tw`w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-700 items-center justify-center`}>
                    <ZapIcon size={22} color="#9CA3AF" strokeWidth={2} />
                  </View>
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[15px] font-semibold text-zinc-400`}>No Active Boost</Text>
                    <Text style={tw`text-[13px] text-zinc-400 mt-0.5`}>
                      Purchase a boost above
                    </Text>
                  </View>
                </View>
              )}

              {liveBoosts.length === 0 && inventoryItems.length > 0 && (
                <View style={tw`h-px bg-zinc-200 dark:bg-zinc-700 ml-16`} />
              )}

              {/* Streak Freeze and other inventory items */}
              {inventoryItems.map((item, index) => {
                const count =
                  item.inventoryKey === "streak_freezes" ? streakFreezeCount : 0;
                const isEmpty = count === 0;
                const IconComponent = item.icon;

                return (
                  <View key={`use-${item.key}`}>
                    <Pressable
                      onPress={() => !isEmpty && handleUseSkill(item)}
                      disabled={isEmpty}
                      style={({ pressed }) => [
                        tw`flex-row items-center py-3.5 px-1 gap-3`,
                        { opacity: pressed && !isEmpty ? 0.7 : 1 },
                      ]}
                    >
                      <View
                        style={[
                          tw`w-11 h-11 rounded-full items-center justify-center`,
                          { backgroundColor: isEmpty ? "#E5E7EB" : `${item.color}15` },
                        ]}
                      >
                        <IconComponent size={22} color={isEmpty ? "#9CA3AF" : item.color} strokeWidth={2} />
                      </View>
                      <View style={tw`flex-1`}>
                        <Text style={tw`text-[15px] font-semibold text-zinc-900 dark:text-zinc-100`}>
                          {item.title}
                        </Text>
                        <Text style={[tw`text-[13px] mt-0.5`, { color: isEmpty ? "#9CA3AF" : item.color }]}>
                          {isEmpty ? "None owned" : `${count} available`}
                        </Text>
                      </View>
                      {/* Light realistic Use button */}
                      <Pressable
                        onPress={() => !isEmpty && handleUseSkill(item)}
                        disabled={isEmpty}
                        style={({ pressed }) => [
                          tw`flex-row items-center gap-1.5 px-4 py-2.5 rounded-full`,
                          {
                            backgroundColor: isEmpty ? "#F5F5F5" : "#FFFFFF",
                            borderWidth: 1,
                            borderColor: isEmpty ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.06)",
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: isEmpty ? 0.03 : 0.08,
                            shadowRadius: 4,
                            elevation: isEmpty ? 1 : 3,
                            borderTopColor: isEmpty ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.9)",
                            borderTopWidth: 1.5,
                            transform: [{ scale: pressed && !isEmpty ? 0.96 : 1 }],
                            opacity: isEmpty ? 0.5 : 1,
                          },
                        ]}
                      >
                        <PlayCircleIcon size={13} color={isEmpty ? "#9CA3AF" : item.color} strokeWidth={2.5} />
                        <Text style={[tw`text-[13px] font-semibold`, { color: isEmpty ? "#9CA3AF" : item.color }]}>Use</Text>
                      </Pressable>
                    </Pressable>
                    {index < inventoryItems.length - 1 && (
                      <View style={tw`h-px bg-zinc-200 dark:bg-zinc-700 ml-16`} />
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
