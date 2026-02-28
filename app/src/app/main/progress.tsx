import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import {
  FlameIcon,
  TargetIcon,
  TrendingUpIcon,
  ZapIcon,
} from "lucide-react-native";
import tw from "twrnc";

import { useMasteryQuery, useStatsQuery, useXPHistoryQuery } from "~/client";
import { MasteryRadar, Spinner, Text } from "~/components";
import XPBarChart from "~/components/XPBarChart";

const BG_COLOR = "#ffffff";
type Range = 7 | 30;

const RangeToggle = ({ value, onChange }: { value: Range; onChange: (r: Range) => void }) => (
  <View style={tw`flex-row rounded-full p-0.5 border-2 border-zinc-500/50`}>
    {([7, 30] as const).map((r) => (
      <Pressable
        key={r}
        onPress={() => onChange(r)}
        style={[
          tw.style("px-4 py-1 rounded-full"),
          value === r && { backgroundColor: "#22C55E" },
        ]}
      >
        <Text
          style={tw.style(
            "text-sm font-bold",
            value === r ? "text-white" : "text-green-700",
          )}
        >
          {r}d
        </Text>
      </Pressable>
    ))}
  </View>
);

const StatCard = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) => (
  <View style={tw`flex-1 items-center bg-green-600/20 rounded-2xl px-2 py-3`}>
    {icon}
    <Text style={tw`text-xl font-bold text-green-800 mt-1`}>{value}</Text>
    <Text style={tw`text-[10px] text-green-700/70 text-center mt-0.5`}>{label}</Text>
  </View>
);

const LifetimeXPBanner = ({ xp }: { xp: number }) => (
  <View style={tw`rounded-2xl border-2 border-zinc-500/50 overflow-hidden`}>
    <View style={tw`flex-row items-center justify-between px-5 py-4`}>
      <View style={tw`flex-row items-center gap-3`}>
        <View style={tw`w-10 h-10 rounded-xl bg-green-500/15 items-center justify-center`}>
          <ZapIcon size={22} color="#22C55E" fill="#22C55E" />
        </View>
        <View>
          <Text style={tw`text-xs text-green-700/70 font-medium`}>Lifetime XP</Text>
          <Text style={tw`text-2xl font-bold text-green-800`}>{xp.toLocaleString()}</Text>
        </View>
      </View>
      <View style={tw`rounded-full bg-green-500/15 px-3 py-1`}>
        <Text style={tw`text-xs font-bold text-green-600`}>All Time</Text>
      </View>
    </View>
  </View>
);

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [range, setRange] = useState<Range>(30);
  const [playToken, setPlayToken] = useState(0);
  const { data: history, isLoading: historyLoading } = useXPHistoryQuery(range);
  const { data: stats, isLoading: statsLoading } = useStatsQuery();
  const { data: mastery } = useMasteryQuery();

  // Replay animations on tab focus
  useEffect(() => {
    if (isFocused) {
      setPlayToken((t) => t + 1);
    }
  }, [isFocused]);

  // Replay animations on range change
  useEffect(() => {
    setPlayToken((t) => t + 1);
  }, [range]);

  const loading = historyLoading || statsLoading;

  if (loading) {
    return (
      <View style={[tw`flex-1 items-center justify-center`, { backgroundColor: BG_COLOR }]}>
        <Spinner size={48} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[tw`flex-1`, { backgroundColor: BG_COLOR }]}
      contentContainerStyle={tw`pb-12`}
    >
      {/* Header */}
      <View style={[tw`items-center pt-2 pb-4`, { paddingTop: insets.top + 4, backgroundColor: BG_COLOR }]}>
        <Text
          style={[tw`text-4xl`, { fontFamily: "Feather-Bold", color: "#115c1a" }]}
        >
          Progress
        </Text>
      </View>

      <View style={tw`px-4 gap-4`}>
        {/* Toggle */}
        <View style={tw`flex-row justify-center`}>
          <RangeToggle value={range} onChange={setRange} />
        </View>

        {/* Stats cards */}
        {stats && (
          <View style={tw`flex-row gap-3`}>
            <StatCard
              label="7-Day Avg"
              value={`${Math.round(stats.seven_day_avg_xp)}`}
              icon={<TrendingUpIcon size={20} color="#16A34A" />}
            />
            <StatCard
              label="Best Streak"
              value={`${stats.thirty_day_best_streak}d`}
              icon={<FlameIcon size={20} color="#fb923c" fill="#c91c16" />}
            />
            <StatCard
              label="Completion"
              value={`${Math.round(stats.completion_rate_30d)}%`}
              icon={<TargetIcon size={20} color="#16A34A" />}
            />
          </View>
        )}

        {/* Lifetime XP */}
        {stats && <LifetimeXPBanner xp={stats.lifetime_xp} />}

        {/* Bar chart */}
        {history && history.length > 0 && (
          <XPBarChart history={history} playToken={playToken} />
        )}

        {/* Mastery Radar */}
        {mastery && mastery.length > 0 && (
          <MasteryRadar data={mastery} playToken={playToken} />
        )}
      </View>
    </ScrollView>
  );
}
