import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Svg, { Polygon, Line, Text as SvgText } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
} from "react-native-reanimated";
import tw from "twrnc";

import type { TopicMasteryResponse } from "~/client/models";

import Text from "./Text";

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

const TOPICS = ["Food", "Culture", "Travel", "Business", "Technology"] as const;
const EMOJIS: Record<string, string> = {
  Food: "🍜",
  Culture: "🎭",
  Travel: "✈️",
  Business: "💼",
  Technology: "💡",
};

const SIZE = 220;
const CENTER = SIZE / 2;
const OUTER_R = 85;

const angleFor = (i: number) => (Math.PI * 2 * i) / 5 - Math.PI / 2;

const vertexAt = (i: number, r: number) => ({
  x: CENTER + r * Math.cos(angleFor(i)),
  y: CENTER + r * Math.sin(angleFor(i)),
});

const buildPolygonPoints = (scores: number[]) =>
  scores
    .map((s, i) => {
      const { x, y } = vertexAt(i, OUTER_R * s);
      return `${x},${y}`;
    })
    .join(" ");

export default function MasteryRadar({ data }: { data: TopicMasteryResponse[] }) {
  const masteryMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of data) map[d.topic] = d.mastery_score;
    return map;
  }, [data]);

  const scores = useMemo(
    () => TOPICS.map((t) => masteryMap[t] ?? 0),
    [masteryMap],
  );

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 1000 });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => {
    const animated = scores.map((s) => s * progress.value);
    return { points: buildPolygonPoints(animated) };
  });

  // Grid rings at 25%, 50%, 75%, 100%
  const gridRings = [0.25, 0.5, 0.75, 1.0];

  return (
    <View style={tw`bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm items-center`}>
      <Text style={tw`text-base font-bold text-zinc-800 dark:text-zinc-100 mb-2`}>
        Mastery Radar
      </Text>
      <Svg width={SIZE} height={SIZE}>
        {/* Grid rings */}
        {gridRings.map((pct) => (
          <Polygon
            key={pct}
            points={TOPICS.map((_, i) => {
              const { x, y } = vertexAt(i, OUTER_R * pct);
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke={tw.color("zinc-200") ?? "#E5E7EB"}
            strokeWidth={1}
          />
        ))}

        {/* Axis lines */}
        {TOPICS.map((_, i) => {
          const { x, y } = vertexAt(i, OUTER_R);
          return (
            <Line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke={tw.color("zinc-200") ?? "#E5E7EB"}
              strokeWidth={1}
            />
          );
        })}

        {/* Data polygon */}
        <AnimatedPolygon
          animatedProps={animatedProps}
          fill="rgba(34,197,94,0.3)"
          stroke="#22C55E"
          strokeWidth={2}
        />

        {/* Vertex labels */}
        {TOPICS.map((topic, i) => {
          const labelR = OUTER_R + 18;
          const { x, y } = vertexAt(i, labelR);
          return (
            <SvgText
              key={topic}
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontSize={14}
            >
              {EMOJIS[topic]}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
