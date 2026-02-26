import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { XIcon } from "lucide-react-native";
import { useAtomValue } from "jotai";
import tw from "twrnc";

import { useSpendGemsMutation } from "~/client";
import { $gemBalance } from "~/store";

import Text from "./Text";
import Button from "./Button";
import GemCounter from "./GemCounter";

type ShopItem = {
  key: string;
  title: string;
  description: string;
  cost: number;
  emoji: string;
  color: string;
};

const SHOP_ITEMS: ShopItem[] = [
  {
    key: "extra_attempts",
    title: "Extra Attempts",
    description: "3 additional pronunciation attempts",
    cost: 40,
    emoji: "🔄",
    color: "#22C55E",
  },
  {
    key: "streak_freeze",
    title: "Streak Freeze",
    description: "Protect your streak for 1 missed day",
    cost: 50,
    emoji: "🛡️",
    color: "#3B82F6",
  },
  {
    key: "hint_pack",
    title: "Hint Pack",
    description: "5 extra pronunciation hints",
    cost: 75,
    emoji: "💡",
    color: "#F59E0B",
  },
  {
    key: "xp_boost_1h",
    title: "XP Boost",
    description: "2x XP for 1 hour",
    cost: 100,
    emoji: "⚡",
    color: "#EF4444",
  },
  {
    key: "avatar_decoration",
    title: "Avatar Decoration",
    description: "A permanent flair for your profile",
    cost: 150,
    emoji: "✨",
    color: "#8B5CF6",
  },
  {
    key: "premium_scenario",
    title: "Premium Scenario",
    description: "Unlock an exclusive conversation scenario",
    cost: 200,
    emoji: "🌟",
    color: "#EC4899",
  },
];

const ShopItemCard = ({
  item,
  canAfford,
  onBuy,
}: {
  item: ShopItem;
  canAfford: boolean;
  onBuy: () => void;
}) => (
  <View
    style={[
      tw`flex-row items-center rounded-2xl p-3.5 gap-3 border`,
      {
        borderColor: canAfford ? item.color + "30" : "#E5E7EB",
        backgroundColor: canAfford ? item.color + "08" : "#FAFAFA",
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
          backgroundColor: item.color + "18",
        },
      ]}
    >
      <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
    </View>
    <View style={tw`flex-1`}>
      <Text style={tw`text-sm font-bold text-zinc-800 dark:text-zinc-100`}>
        {item.title}
      </Text>
      <Text style={tw`text-xs text-zinc-500 mt-0.5`}>{item.description}</Text>
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
      <Text style={tw`text-xs font-bold text-white`}>💎 {item.cost}</Text>
    </Button>
  </View>
);

export default function GemShop({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const balance = useAtomValue($gemBalance);
  const spendMutation = useSpendGemsMutation();
  const [purchasing, setPurchasing] = useState(false);

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
                Alert.alert("Success!", `You purchased ${item.title}!`);
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
          style={tw`bg-white dark:bg-zinc-900 rounded-t-3xl px-6 pt-4 pb-10 shadow-2xl max-h-[75%]`}
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
