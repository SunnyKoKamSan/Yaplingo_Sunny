import { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import {
  AwardIcon,
  DiamondIcon,
  FlameIcon,
  FootprintsIcon,
  MicIcon,
  Mic2Icon,
  ZapIcon,
  LockIcon,
} from "lucide-react-native";
import tw from "twrnc";

import type { AchievementResponse } from "~/client/models";

import Text from "./Text";
import Button from "./Button";

const ICON_MAP: Record<string, React.ReactNode> = {
  first_step: <FootprintsIcon size={24} color="#16A34A" />,
  bronze_mic: <MicIcon size={24} color="#CD7F32" />,
  silver_mic: <Mic2Icon size={24} color="#9CA3AF" />,
  gold_mic: <AwardIcon size={24} color="#B8860B" />,
  streak_5: <FlameIcon size={24} color="#F97316" />,
  streak_30: <ZapIcon size={24} color="#8B5CF6" />,
  diamond_food: <DiamondIcon size={24} color="#0EA5E9" />,
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
  const entering = item.unlocked
    ? ZoomIn.delay(index * 60).duration(300)
    : FadeIn.delay(index * 40).duration(200);

  return (
    <Animated.View entering={entering} style={tw`flex-1 p-1.5`}>
      <Pressable
        onPress={onPress}
        style={tw.style(
          "items-center rounded-2xl border-2 px-2 py-4",
          item.unlocked
            ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 shadow-sm"
            : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 opacity-40",
        )}
      >
        <View
          style={tw.style(
            "items-center justify-center rounded-full w-12 h-12 mb-2",
            item.unlocked ? "bg-amber-100 dark:bg-amber-900/40" : "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          {item.unlocked
            ? (ICON_MAP[item.key] ?? <AwardIcon size={24} color="#16A34A" />)
            : <LockIcon size={20} color="#9CA3AF" />}
        </View>
        <Text
          style={tw.style(
            "text-xs font-bold text-center",
            item.unlocked ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-400",
          )}
          numberOfLines={2}
        >
          {item.title}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

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

  return (
    <>
      <FlatList
        data={achievements}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        numColumns={3}
        scrollEnabled={false}
        contentContainerStyle={tw`px-1`}
      />

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable
          style={tw`flex-1 items-center justify-center bg-black/50`}
          onPress={() => setSelected(null)}
        >
          <Pressable
            style={tw`mx-8 w-72 rounded-3xl bg-white dark:bg-zinc-900 p-6 items-center shadow-xl`}
            onPress={() => {}}
          >
            <View
              style={tw.style(
                "items-center justify-center rounded-full w-16 h-16 mb-3",
                selected?.unlocked
                  ? "bg-amber-100 dark:bg-amber-900/40"
                  : "bg-zinc-100 dark:bg-zinc-800",
              )}
            >
              {selected
                ? selected.unlocked
                  ? (ICON_MAP[selected.key] ?? <AwardIcon size={28} color="#16A34A" />)
                  : <LockIcon size={24} color="#9CA3AF" />
                : null}
            </View>
            <Text style={tw`text-lg font-bold text-center text-zinc-800 dark:text-zinc-100`}>
              {selected?.title}
            </Text>
            <Text style={tw`text-sm text-center text-zinc-500 mt-1`}>
              {selected?.desc}
            </Text>
            <Text style={tw`text-xs text-center mt-3 font-medium text-green-600`}>
              {selected?.unlocked
                ? `Earned: ${new Date(selected.unlocked_at!).toLocaleDateString()}`
                : "Keep practicing!"}
            </Text>
            <Button
              onPress={() => setSelected(null)}
              style={tw`mt-4 px-6 bg-green-500 border-transparent`}
            >
              <Text style={tw`text-sm font-bold text-white`}>Close</Text>
            </Button>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
