import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import Svg, { Polygon, Line, Text as SvgText } from "react-native-svg";
import tw from "twrnc";

import type { TopicMasteryResponse } from "~/client/models";

import Text from "./Text";

const TOPICS = ["Food", "Culture", "Travel", "Business", "Technology"] as const;
const EMOJIS: Record<string, string> = {
  Food: "🍜",
  Culture: "🎭",
  Travel: "✈️",
  Business: "💼",
  Technology: "💡",
};

const SIZE = 260;
const CENTER = SIZE / 2;
const OUTER_R = 85;
const DATA_MAX_SCALE = 0.92;

const angleFor = (i: number) => (Math.PI * 2 * i) / 5 - Math.PI / 2;

const vertexAt = (i: number, r: number) => ({
  x: CENTER + r * Math.cos(angleFor(i)),
  y: CENTER + r * Math.sin(angleFor(i)),
});

const buildPolygonPoints = (scores: number[]) =>
  scores
    .map((s, i) => {
      const { x, y } = vertexAt(i, OUTER_R * Math.min(Math.max(s, 0), 1) * DATA_MAX_SCALE);
      return `${x},${y}`;
    })
    .join(" ");

const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export default function MasteryRadar({ data, playToken }: { data: TopicMasteryResponse[]; playToken?: number }) {
  const masteryMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of data) {
      if (!TOPICS.includes(d.topic as (typeof TOPICS)[number])) continue;
      map[d.topic] = d.mastery_score;
    }
    return map;
  }, [data]);

  const scores = useMemo(
    () => TOPICS.map((t) => {
      const score = masteryMap[t] ?? 0;
      if (!Number.isFinite(score)) return 0;
      return Math.min(Math.max(score, 0), 1);
    }),
    [masteryMap],
  );
  const scoreKey = useMemo(
    () => scores.map((score) => score.toFixed(4)).join("|"),
    [scores],
  );

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    const start = Date.now();
    const duration = 900;
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      setProgress(easeOutBack(t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [playToken, scoreKey]);

  const hasAnyPractice = data.some((d) => d.lesson_count > 0);
  const animationFactor = Math.min(Math.max(progress, 0), 1.02);
  const animatedScores = scores.map((s) => s * animationFactor);
  const points = buildPolygonPoints(animatedScores);

  const gridRings = [0.25, 0.5, 0.75, 1.0];

  return (
    <View style={tw`rounded-2xl border-2 border-zinc-500/50 p-4 items-center`}>
      <Text style={tw`text-base font-bold mb-2`}>
        🎯 Mastery Radar
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
        <Polygon
          points={points}
          fill={hasAnyPractice ? "rgba(34,197,94,0.3)" : "rgba(34,197,94,0.1)"}
          stroke="#22C55E"
          strokeWidth={2}
        />

        {/* Vertex labels — emoji only, large */}
        {TOPICS.map((topic, i) => {
          const labelR = OUTER_R + 22;
          const { x, y } = vertexAt(i, labelR);
          return (
            <SvgText key={topic} x={x} y={y + 6} textAnchor="middle" fontSize={22}>
              {EMOJIS[topic]}
            </SvgText>
          );
        })}
      </Svg>
      {!hasAnyPractice && (
        <Text style={tw`mt-1 text-xs text-zinc-500`}>
          No practice yet — start one category to see your first spike.
        </Text>
      )}
    </View>
  );
}
