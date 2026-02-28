import { useEffect, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import tw from "twrnc";

import type { HistoryEntry } from "~/client/models";

import Text from "./Text";

const DAILY_GOAL_XP = 200;
const CHART_HEIGHT = 200;
const TOP_PAD = 24;
const BOTTOM_PAD = 20;
const BAR_AREA = CHART_HEIGHT - TOP_PAD - BOTTOM_PAD;

const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export default function XPBarChart({
  history,
  playToken,
}: {
  history: HistoryEntry[];
  playToken: number;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 48;
  const [selected, setSelected] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    setSelected(null);
    const start = Date.now();
    const duration = 800;
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      setProgress(easeOutBack(t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [playToken]);

  const n = history.length;
  const gap = 2;
  const barWidth = Math.max((chartWidth - gap * (n - 1)) / n, 2);

  const maxXP = Math.max(...history.map((h) => h.xp_earned), DAILY_GOAL_XP * 1.2);
  const scale = (xp: number) => (xp / maxXP) * BAR_AREA;

  const goalY = TOP_PAD + BAR_AREA - scale(DAILY_GOAL_XP);

  const selectedEntry = selected !== null ? history[selected] : null;

  return (
    <View style={tw`rounded-2xl border-2 border-zinc-500/50 p-3`}>
      <Text style={tw`text-base font-bold mb-2 px-1`}>📊 XP History</Text>

      {/* Tooltip */}
      {selectedEntry && selected !== null && (
        <View
          style={[
            tw`absolute z-10 rounded-xl px-3 py-1.5 items-center shadow-sm`,
            {
              backgroundColor: "#1e293b",
              top: 36,
              left: Math.min(
                Math.max(selected * (barWidth + gap) + barWidth / 2 - 50, 16),
                chartWidth - 96,
              ),
            },
          ]}
        >
          <Text style={tw`text-xs text-zinc-300`}>
            {selectedEntry.date_key.slice(5)}
          </Text>
          <Text style={tw`text-sm font-bold text-white`}>
            {selectedEntry.xp_earned} XP {selectedEntry.goal_met ? "✅" : ""}
          </Text>
        </View>
      )}

      <Svg width={chartWidth} height={CHART_HEIGHT}>
        {/* Goal line (dashed) */}
        <Line
          x1={0}
          y1={goalY}
          x2={chartWidth}
          y2={goalY}
          stroke="#f97316"
          strokeWidth={1.5}
          strokeDasharray="6,4"
        />

        {/* Bars — animated from ground */}
        {history.map((entry, i) => {
          const fullH = Math.max(scale(entry.xp_earned), 2);
          const barH = fullH * Math.max(progress, 0);
          const x = i * (barWidth + gap);
          const y = TOP_PAD + BAR_AREA - barH;
          const fill = entry.goal_met
            ? "#16a34a"
            : entry.xp_earned > 0
              ? "#97d4ad"
              : "#e5e7eb";

          return (
            <Rect
              key={entry.date_key}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={barWidth > 4 ? 3 : 1}
              fill={fill}
              opacity={selected === null || selected === i ? 1 : 0.35}
              onPress={() => setSelected(selected === i ? null : i)}
            />
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={tw`flex-row justify-center gap-4 mt-2`}>
        <View style={tw`flex-row items-center gap-1`}>
          <View style={[tw`w-3 h-3 rounded-sm`, { backgroundColor: "#16a34a" }]} />
          <Text style={tw`text-xs text-zinc-500`}>Goal met</Text>
        </View>
        <View style={tw`flex-row items-center gap-1`}>
          <View style={[tw`w-3 h-3 rounded-sm`, { backgroundColor: "#97d4ad" }]} />
          <Text style={tw`text-xs text-zinc-500`}>Active</Text>
        </View>
        <View style={tw`flex-row items-center gap-1`}>
          <View style={[tw`w-3 h-3 rounded-sm`, { backgroundColor: "#f97316" }]} />
          <Text style={tw`text-xs text-zinc-500`}>Goal ({DAILY_GOAL_XP})</Text>
        </View>
      </View>
    </View>
  );
}
