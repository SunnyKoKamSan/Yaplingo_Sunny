import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { ShieldIcon, ZapIcon, SparklesIcon, XIcon } from "lucide-react-native";
import tw from "twrnc";

import { useSpendGemsMutation } from "~/client";

import Text from "./Text";
import Button from "./Button";
import GemCounter from "./GemCounter";

type ShopItem = {
  key: string;
  title: string;
  description: string;
  cost: number;
  icon: React.ReactNode;
};

const SHOP_ITEMS: ShopItem[] = [
  {
    key: "streak_freeze",
    title: "Streak Freeze",
    description: "Protect your streak for 1 missed day",
    cost: 50,
    icon: <ShieldIcon size={22} color="#3B82F6" />,
  },
  {
    key: "xp_boost_1h",
    title: "XP Boost",
    description: "2x XP for 1 hour",
    cost: 100,
    icon: <ZapIcon size={22} color="#F59E0B" />,
  },
  {
    key: "avatar_decoration",
    title: "Avatar Decoration",
    description: "A permanent flair for your profile",
    cost: 150,
    icon: <SparklesIcon size={22} color="#8B5CF6" />,
  },
];

const ShopItemRow = ({
  item,
  canAfford,
  onBuy,
}: {
  item: ShopItem;
  canAfford: boolean;
  onBuy: () => void;
}) => (
  <View
    style={tw`flex-row items-center rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-4 gap-3`}
  >
    <View
      style={tw`items-center justify-center w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800`}
    >
      {item.icon}
    </View>
    <View style={tw`flex-1`}>
      <Text style={tw`text-base font-bold text-zinc-800 dark:text-zinc-100`}>
        {item.title}
      </Text>
      <Text style={tw`text-xs text-zinc-500`}>{item.description}</Text>
    </View>
    <Button
      disabled={!canAfford}
      onPress={onBuy}
      style={tw.style(
        "px-4 py-2 border-transparent rounded-xl",
        canAfford ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-700 opacity-50",
      )}
    >
      <Text
        style={tw.style(
          "text-sm font-bold",
          canAfford ? "text-white" : "text-zinc-500",
        )}
      >
        💎 {item.cost}
      </Text>
    </Button>
  </View>
);

export default function GemShop({
  visible,
  onClose,
  balance,
}: {
  visible: boolean;
  onClose: () => void;
  balance: number;
}) {
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
          style={tw`bg-white dark:bg-zinc-900 rounded-t-3xl px-6 pt-4 pb-10 shadow-2xl`}
        >
          {/* Handle bar */}
          <View style={tw`items-center mb-3`}>
            <View style={tw`w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600`} />
          </View>

          {/* Header */}
          <View style={tw`flex-row items-center justify-between mb-5`}>
            <Text style={tw`text-2xl font-bold text-zinc-800 dark:text-zinc-100`}>
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
          <View style={tw`gap-3`}>
            {SHOP_ITEMS.map((item) => (
              <ShopItemRow
                key={item.key}
                item={item}
                canAfford={balance >= item.cost && !purchasing}
                onBuy={() => handleBuy(item)}
              />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
