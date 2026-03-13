import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useSharedValue, useAnimatedStyle, withTiming, withDelay, runOnJS } from "react-native-reanimated";
import {
  ShieldIcon,
  XIcon,
  ZapIcon,
  RocketIcon,
  ArrowUpCircleIcon,
  PlayCircleIcon,
  type LucideIcon,
} from "lucide-react-native";
import { useAtomValue } from "jotai";
import tw from "twrnc";

import { useGemConfigQuery, useInventoryQuery, useSpendGemsMutation, useUseSkillMutation, useActiveEventsQuery } from "~/client";
import { $gemBalance } from "~/store";

import Text from "./Text";
import Button from "./Button";
import GemCounter from "./GemCounter";

type ShopItem = {
  key: string;
  title: string;
  description: string;
  fallbackCost: number;
  icon: LucideIcon;
  color: string;
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
    inventoryKey: "streak_freezes",
    inventoryLabel: (c) => `${c} freeze${c !== 1 ? "s" : ""} stored`,
  },
  {
    key: "xp_boost_1h",
    title: "2× XP Boost",
    description: "Double XP for the next hour",
    fallbackCost: 100,
    icon: ZapIcon,
    color: "#EF4444",
  },
  {
    key: "buy_xp_500",
    title: "Buy 500 XP",
    description: "Instantly add 500 XP to your total",
    fallbackCost: 50,
    icon: ArrowUpCircleIcon,
    color: "#22C55E",
  },
  {
    key: "xp_boost_30m_30x",
    title: "30× XP Mega Boost",
    description: "30× XP for 30 minutes — go big!",
    fallbackCost: 500,
    icon: RocketIcon,
    color: "#8B5CF6",
  },
];

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
    <View
      style={[
        tw`flex-row items-center rounded-2xl p-3.5 gap-3`,
        {
          backgroundColor: canAfford ? item.color + "08" : "#FAFAFA",
          borderWidth: 1,
          borderColor: canAfford ? item.color + "25" : "#E5E7EB",
        },
      ]}
    >
      <View
        style={[
          {
            width: 44,
            height: 44,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: item.color + "15",
          },
        ]}
      >
        <IconComponent size={22} color={item.color} strokeWidth={2} />
      </View>
      <View style={tw`flex-1`}>
        <Text style={tw`text-sm font-bold text-zinc-800 dark:text-zinc-100`}>
          {item.title}
        </Text>
        <Text style={tw`text-xs text-zinc-500 mt-0.5`}>{item.description}</Text>
        {item.inventoryLabel && inventoryCount != null && inventoryCount > 0 && (
          <Text style={[tw`text-[10px] font-medium mt-0.5`, { color: item.color }]}>
            {item.inventoryLabel(inventoryCount)}
          </Text>
        )}
      </View>
      <Button
        disabled={!canAfford}
        onPress={onBuy}
        style={tw.style(
          "px-3.5 py-2 rounded-xl border-transparent",
          {
            backgroundColor: canAfford ? item.color : "#D1D5DB",
            opacity: canAfford ? 1 : 0.5,
          },
        )}
      >
        <Text style={tw`text-xs font-bold text-white`}>
          💎 {cost}
        </Text>
      </Button>
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
  const { data: inventory, refetch: refetchInventory } = useInventoryQuery();
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
                await spendMutation.mutateAsync({ item_key: item.key });
                showToast(`✨ ${item.title} purchased!`);
              } catch {
                Alert.alert("Failed", "Could not complete purchase. Check your gem balance.");
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
        showToast(`🛡️ ${res.message}`);
      } catch {
        Alert.alert("Cannot Use", "No items available or activation failed.");
      }
    },
    [useSkillMutation, showToast],
  );

  if (!visible) return null;

  const streakFreezeCount = inventory?.streak_freezes ?? 0;
  const inventoryItems = SHOP_ITEMS.filter((item) => item.inventoryKey !== undefined);

  // Active XP boosts — filter out any that have expired client-side
  const liveBoosts = activeEvents.filter(
    (e) => new Date(e.ends_at).getTime() > now,
  );

  const formatCountdown = (endsAt: string) => {
    const secsLeft = Math.max(0, Math.round((new Date(endsAt).getTime() - now) / 1000));
    const m = Math.floor(secsLeft / 60);
    const s = secsLeft % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={tw`flex-1 justify-end bg-black/50`}
      >
        <Pressable style={tw`flex-1`} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(300)}
          exiting={SlideOutDown.duration(250)}
          style={tw`bg-white dark:bg-zinc-900 rounded-t-3xl px-6 pt-4 pb-10 shadow-2xl max-h-[80%]`}
        >
          {/* Handle bar */}
          <View style={tw`items-center mb-3`}>
            <View style={tw`w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600`} />
          </View>

          {/* Header */}
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <Text style={tw`text-xl font-bold text-zinc-800 dark:text-zinc-100`}>
              Gem Shop 💎
            </Text>
            <View style={tw`flex-row items-center gap-3`}>
              <GemCounter />
              <Pressable onPress={onClose} hitSlop={12}>
                <XIcon size={22} color={tw.color("zinc-400")} />
              </Pressable>
            </View>
          </View>

          {/* Toast */}
          {!!toastMsg && (
            <Animated.View
              style={[
                toastStyle,
                tw`absolute left-6 right-6 z-50 rounded-2xl px-4 py-3 items-center`,
                { top: 72, backgroundColor: "rgba(30,41,59,0.92)" },
              ]}
              pointerEvents="none"
            >
              <Text style={tw`text-white text-sm font-semibold text-center`}>{toastMsg}</Text>
            </Animated.View>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={tw`gap-2.5 pb-2`}>
              {SHOP_ITEMS.map((item) => {
                const cost = getCost(item);
                return (
                  <ShopItemCard
                    key={item.key}
                    item={item}
                    cost={cost}
                    canAfford={balance >= cost && !purchasing}
                    inventoryCount={getInventoryCount(item)}
                    onBuy={() => handleBuy(item)}
                  />
                );
              })}

              {/* My Skills section — always shown */}
              <>
                <View style={tw`flex-row items-center gap-2 mt-3 mb-1`}>
                  <View style={tw`flex-1 h-px bg-zinc-200`} />
                  <Text style={tw`text-xs font-semibold text-zinc-400 uppercase tracking-wider`}>
                    My Skills
                  </Text>
                  <View style={tw`flex-1 h-px bg-zinc-200`} />
                </View>

                {/* Active XP boosts with live countdown */}
                {liveBoosts.length > 0 ? (
                  liveBoosts.map((event) => (
                    <View
                      key={event.id}
                      style={[
                        tw`flex-row items-center rounded-2xl p-3.5 gap-3`,
                        { backgroundColor: "#EF444408", borderWidth: 1, borderColor: "#EF444425" },
                      ]}
                    >
                      <View
                        style={{
                          width: 44, height: 44, borderRadius: 14,
                          alignItems: "center", justifyContent: "center",
                          backgroundColor: "#EF444415",
                        }}
                      >
                        <ZapIcon size={22} color="#EF4444" strokeWidth={2} />
                      </View>
                      <View style={tw`flex-1`}>
                        <View style={tw`flex-row items-center gap-1.5`}>
                          <Text style={tw`text-sm font-bold text-zinc-800 dark:text-zinc-100`}>
                            {event.multiplier}× XP Boost
                          </Text>
                          <View style={[tw`rounded-full px-1.5 py-0.5`, { backgroundColor: "#EF444420" }]}>
                            <Text style={[tw`text-[10px] font-bold`, { color: "#EF4444" }]}>ACTIVE</Text>
                          </View>
                        </View>
                        <Text style={[tw`text-xs font-semibold mt-0.5`, { color: "#EF4444" }]}>
                          ⏱ {formatCountdown(event.ends_at)} left
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View
                    style={[
                      tw`flex-row items-center rounded-2xl p-3.5 gap-3`,
                      { backgroundColor: "#EF444408", borderWidth: 1, borderColor: "#EF444425" },
                    ]}
                  >
                    <View
                      style={{
                        width: 44, height: 44, borderRadius: 14,
                        alignItems: "center", justifyContent: "center",
                        backgroundColor: "#EF444415",
                      }}
                    >
                      <ZapIcon size={22} color="#9CA3AF" strokeWidth={2} />
                    </View>
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-sm font-bold text-zinc-800 dark:text-zinc-100`}>
                        XP Boost
                      </Text>
                      <Text style={[tw`text-xs font-medium mt-0.5`, { color: "#9CA3AF" }]}>
                        No active boost — buy 2× or 30× in shop
                      </Text>
                    </View>
                  </View>
                )}

                {/* Streak Freeze and other inventory items */}
                {inventoryItems.map((item) => {
                  const count =
                    item.inventoryKey === "streak_freezes" ? streakFreezeCount : 0;
                  const isEmpty = count === 0;
                  const IconComponent = item.icon;
                  return (
                    <View
                      key={`use-${item.key}`}
                      style={[
                        tw`flex-row items-center rounded-2xl p-3.5 gap-3`,
                        { backgroundColor: item.color + "08", borderWidth: 1, borderColor: item.color + "25" },
                      ]}
                    >
                      <View
                        style={[
                          { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: item.color + "15" },
                        ]}
                      >
                        <IconComponent size={22} color={isEmpty ? "#9CA3AF" : item.color} strokeWidth={2} />
                      </View>
                      <View style={tw`flex-1`}>
                        <Text style={tw`text-sm font-bold text-zinc-800 dark:text-zinc-100`}>
                          {item.title}
                        </Text>
                        <Text style={[tw`text-xs font-medium mt-0.5`, { color: isEmpty ? "#9CA3AF" : item.color }]}>
                          {isEmpty ? "None owned — buy in shop" : `${count} available`}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => !isEmpty && handleUseSkill(item)}
                        disabled={isEmpty}
                        style={[
                          tw`flex-row items-center gap-1 px-3.5 py-2 rounded-xl`,
                          { backgroundColor: isEmpty ? "#D1D5DB" : item.color },
                        ]}
                      >
                        <PlayCircleIcon size={14} color="white" strokeWidth={2.5} />
                        <Text style={tw`text-xs font-bold text-white`}>Use</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
