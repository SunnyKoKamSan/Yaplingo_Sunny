import { useEffect } from "react";
import { Image, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
} from "react-native-reanimated";
import { ShieldIcon, ShieldCheckIcon, StarIcon } from "lucide-react-native";
import tw from "twrnc";

import type { MasteryTier, TopicMasteryResponse } from "~/client/models";

import Text from "./Text";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const GEM_ICON_SOURCE = require("../../assets/gem.png");

const TIER_COLORS: Record<MasteryTier, string> = {
  Bronze: "#CD7F32",
  Silver: "#C0C0C0",
  Gold: "#FFD700",
  Platinum: "#E5E4E2",
  Diamond: "#B9F2FF",
};

const TIER_ICON: Record<MasteryTier, React.ReactNode> = {
  Bronze: <ShieldIcon size={12} color="#CD7F32" />,
  Silver: <ShieldCheckIcon size={12} color="#6B7280" />,
  Gold: <StarIcon size={12} color="#B8860B" fill="#FFD700" />,
  Platinum: <Image source={GEM_ICON_SOURCE} resizeMode="contain" style={{ width: 12, height: 12, opacity: 0.72 }} />,
  Diamond: <Image source={GEM_ICON_SOURCE} resizeMode="contain" style={{ width: 12, height: 12 }} />,
};

const TOPIC_EMOJIS: Record<string, string> = {
  Food: "🍜",
  Culture: "🎭",
  Travel: "✈️",
  Business: "💼",
  Technology: "💡",
};

const RADIUS = 40;
const STROKE = 8;
const SIZE = (RADIUS + STROKE) * 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function MasteryCard({ data }: { data: TopicMasteryResponse }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(data.mastery_score, { duration: 1200 });
  }, [data.mastery_score, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const tierColor = TIER_COLORS[data.tier];
  const emoji = TOPIC_EMOJIS[data.topic] ?? "📚";
  const avgSpeedSec = (data.avg_speed_ms / 1000).toFixed(1);

  return (
    <View style={tw`bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm`}>
      <View style={tw`flex-row items-center gap-3`}>
        {/* Radial gauge */}
        <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={tw.color("zinc-200") ?? "#E5E7EB"}
              strokeWidth={STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={tierColor}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={animatedProps}
              strokeLinecap="round"
              rotation="-90"
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          </Svg>
          <View style={[tw`absolute items-center justify-center`, { width: SIZE, height: SIZE }]}>
            <Text style={tw`text-lg`}>{emoji}</Text>
            <Text style={tw`text-xs font-bold text-zinc-700 dark:text-zinc-300`}>
              {Math.round(data.mastery_score * 100)}%
            </Text>
          </View>
        </View>

        {/* Info column */}
        <View style={tw`flex-1`}>
          <Text style={tw`text-base font-bold text-zinc-800 dark:text-zinc-100`}>
            {data.topic}
          </Text>

          {/* Tier badge */}
          <View
            style={[
              tw`self-start flex-row items-center gap-1 rounded-full px-2.5 py-0.5 mt-1`,
              { backgroundColor: tierColor + "22" },
            ]}
          >
            {TIER_ICON[data.tier]}
            <Text style={[tw`text-xs font-bold`, { color: tierColor }]}>{data.tier}</Text>
          </View>

          {/* Stat chips */}
          <View style={tw`flex-row gap-2 mt-2 flex-wrap`}>
            <View style={tw`bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1`}>
              <Text style={tw`text-xs text-zinc-600 dark:text-zinc-400`}>
                Acc: {Math.round(data.avg_accuracy)}%
              </Text>
            </View>
            <View style={tw`bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1`}>
              <Text style={tw`text-xs text-zinc-600 dark:text-zinc-400`}>
                Speed: {avgSpeedSec}s
              </Text>
            </View>
            <View style={tw`bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1`}>
              <Text style={tw`text-xs text-zinc-600 dark:text-zinc-400`}>
                XP: {data.total_xp.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
