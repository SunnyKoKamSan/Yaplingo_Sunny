import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import {
  BookOpenIcon,
  LightbulbIcon,
  ShieldIcon,
  SparklesIcon,
  StarIcon,
  XIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react-native";
import { useAtomValue } from "jotai";
import tw from "twrnc";

import { useInventoryQuery, useSpendGemsMutation } from "~/client";
import { $gemBalance } from "~/store";

import Text from "./Text";
import Button from "./Button";
import GemCounter from "./GemCounter";

type ShopItem = {
  key: string;
  title: string;
  description: string;
  cost: number;
  icon: LucideIcon;
  color: string;
  inventoryKey?: string;
  inventoryLabel?: (count: number) => string;
};

const SHOP_ITEMS: ShopItem[] = [
  {
    key: "extra_attempts",
    title: "Extra Attempts",
    description: "Get 3 additional pronunciation attempts",
    cost: 40,
    icon: BookOpenIcon,
    color: "#22C55E",
    inventoryKey: "extra_attempts",
    inventoryLabel: (c) => `${c} attempts left`,
  },
  {
    key: "streak_freeze",
    title: "Streak Freeze",
    description: "Protect your streak for 1 missed day",
    cost: 50,
    icon: ShieldIcon,
    color: "#3B82F6",
    inventoryKey: "streak_freezes",
    inventoryLabel: (c) => `${c} freeze${c !== 1 ? "s" : ""} stored`,
  },
  {
    key: "hint_pack",
    title: "Hint Pack",
    description: "Unlock 5 extra pronunciation hints",
    cost: 75,
    icon: LightbulbIcon,
    color: "#F59E0B",
    inventoryKey: "hint_packs",
    inventoryLabel: (c) => `${c} hint${c !== 1 ? "s" : ""} left`,
  },
  {
    key: "xp_boost_1h",
    title: "XP Boost",
    description: "2× XP for the next 1 hour",
    cost: 100,
    icon: ZapIcon,
    color: "#EF4444",
  },
  {
    key: "avatar_decoration",
    title: "Avatar Flair",
    description: "Permanent decoration for your profile",
    cost: 150,
    icon: SparklesIcon,
    color: "#8B5CF6",
    inventoryKey: "has_avatar_decoration",
    inventoryLabel: () => "Owned ✓",
  },
  {
    key: "premium_scenario",
    title: "Premium Scenario",
    description: "Unlock an exclusive conversation scenario",
    cost: 200,
    icon: StarIcon,
    color: "#EC4899",
    inventoryKey: "premium_scenarios",
    inventoryLabel: (c) => `${c} unlocked`,
  },
];

const ShopItemCard = ({
  item,
  canAfford,
  inventoryCount,
  onBuy,
}: {
  item: ShopItem;
  canAfford: boolean;
  inventoryCount?: number;
  onBuy: () => void;
}) => {
  const IconComponent = item.icon;
  const isOwned = item.key === "avatar_decoration" && inventoryCount === 1;

  return (
    <View
      style={[
        tw`flex-row items-center rounded-2xl p-3.5 gap-3`,
        {
          backgroundColor: canAfford && !isOwned ? item.color + "08" : "#FAFAFA",
          borderWidth: 1,
          borderColor: canAfford && !isOwned ? item.color + "25" : "#E5E7EB",
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
        disabled={!canAfford || isOwned}
        onPress={onBuy}
        style={tw.style(
          "px-3.5 py-2 rounded-xl border-transparent",
          {
            backgroundColor: isOwned ? "#D1D5DB" : canAfford ? item.color : "#D1D5DB",
            opacity: canAfford && !isOwned ? 1 : 0.5,
          },
        )}
      >
        <Text style={tw`text-xs font-bold text-white`}>
          {isOwned ? "Owned" : `💎 ${item.cost}`}
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
  const { data: inventory } = useInventoryQuery();
  const [purchasing, setPurchasing] = useState(false);

  const getInventoryCount = (item: ShopItem): number | undefined => {
    if (!inventory || !item.inventoryKey) return undefined;
    const val = (inventory as Record<string, unknown>)[item.inventoryKey];
    if (typeof val === "boolean") return val ? 1 : 0;
    if (typeof val === "number") return val;
    return undefined;
  };

  const handleBuy = useCallback(
    (item: ShopItem) => {
      Alert.alert(
        "Confirm Purchase",
        `Spend ${item.cost} 💎 on ${item.title}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Buy",
            onPress: async () => {
              setPurchasing(true);
              try {
                await spendMutation.mutateAsync({ item_key: item.key });
                Alert.alert("Success! ✨", `You purchased ${item.title}!`);
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
    [spendMutation],
  );

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={tw`flex-1 justify-end bg-black/50`}
      >
        <Pressable style={tw`flex-1`} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(300).springify().damping(18)}
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

          {/* Items */}
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={tw`gap-2.5 pb-2`}>
              {SHOP_ITEMS.map((item) => (
                <ShopItemCard
                  key={item.key}
                  item={item}
                  canAfford={balance >= item.cost && !purchasing}
                  inventoryCount={getInventoryCount(item)}
                  onBuy={() => handleBuy(item)}
                />
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
