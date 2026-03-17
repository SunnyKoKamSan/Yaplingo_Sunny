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
import type { StatsResponse } from "~/client/models";
import { MasteryRadar, Spinner, Text } from "~/components";
import XPBarChart from "~/components/XPBarChart";

const BG_COLOR = "#ffffff";
type Range = 7 | 30;

const StatCard = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) => (
  <View style={tw`flex-1 items-center bg-green-600/20 rounded-xl px-2 py-2`}>
    {icon}
    <Text style={tw`text-base font-bold text-green-800 mt-0.5`}>{value}</Text>
    <Text style={tw`text-[10px] text-green-700/70 text-center mt-0.5`}>{label}</Text>
  </View>
);

const LifetimeXPBanner = ({ xp, todayXp, stats }: { xp: number; todayXp: number; stats: StatsResponse }) => {
  const [tab, setTab] = useState<"lifetime" | "today">("lifetime");
  const isToday = tab === "today";
  const displayXp = isToday ? todayXp : xp;

  return (
    <View style={tw`rounded-2xl border-2 border-zinc-500/50 overflow-hidden`}>
      <View style={tw`flex-row border-b border-zinc-200`}>
        {(["lifetime", "today"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[
              tw`flex-1 items-center py-2.5`,
              t === tab && { borderBottomWidth: 2, borderBottomColor: "#22C55E", marginBottom: -1 },
            ]}
          >
            <Text
              style={[
                tw`text-xs font-bold uppercase tracking-wide`,
                { color: t === tab ? "#16A34A" : "#A1A1AA" },
              ]}
            >
              {t === "lifetime" ? "All Time" : "Today"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={tw`flex-row items-center justify-between px-5 py-4`}>
        <View style={tw`flex-row items-center gap-3`}>
          <View style={tw`w-10 h-10 rounded-xl bg-green-500/15 items-center justify-center`}>
            <ZapIcon size={22} color="#22C55E" fill="#22C55E" />
          </View>
          <View>
            <Text style={tw`text-xs text-green-700/70 font-medium`}>
              {isToday ? "Today's XP" : "Lifetime XP"}
            </Text>
            <Text style={tw`text-2xl font-bold text-green-800`}>
              {displayXp.toLocaleString()}
            </Text>
          </View>
        </View>
        <View
          style={[
            tw`rounded-full px-3 py-1`,
            { backgroundColor: isToday ? "rgba(234,179,8,0.15)" : "rgba(34,197,94,0.15)" },
          ]}
        >
          <Text style={[tw`text-xs font-bold`, { color: isToday ? "#CA8A04" : "#16A34A" }]}>
            {isToday ? "⚡ In Progress" : "All Time"}
          </Text>
        </View>
      </View>

      <View style={tw`flex-row gap-2 px-3 pb-3`}>
        <StatCard
          label="7-Day Avg"
          value={`${Math.round(stats.seven_day_avg_xp)}`}
          icon={<TrendingUpIcon size={16} color="#16A34A" />}
        />
        <StatCard
          label="Best Streak"
          value={`${stats.thirty_day_best_streak}d`}
          icon={<FlameIcon size={16} color="#fb923c" fill="#c91c16" />}
        />
        <StatCard
          label="Completion"
          value={`${Math.round(stats.completion_rate_30d)}%`}
          icon={<TargetIcon size={16} color="#16A34A" />}
        />
      </View>
    </View>
  );
};

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [range, setRange] = useState<Range>(30);
  const [playToken, setPlayToken] = useState(0);
  const { data: history, isLoading: historyLoading } = useXPHistoryQuery(range);
  const { data: stats, isLoading: statsLoading } = useStatsQuery();
  const { data: mastery, refetch: refetchMastery } = useMasteryQuery();

  useEffect(() => {
    if (!isFocused) return;
    setPlayToken((t) => t + 1);
    void refetchMastery();
  }, [isFocused, refetchMastery]);

  useEffect(() => {
    setPlayToken((t) => t + 1);
  }, [range]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayXp = history?.find((h) => h.date_key === todayKey)?.xp_earned ?? 0;
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
      <View style={[tw`items-center pt-2 pb-4`, { paddingTop: insets.top + 4, backgroundColor: BG_COLOR }]}>
        <Text style={[tw`text-4xl`, { fontFamily: "Feather-Bold", color: "#115c1a" }]}>
          Progress
        </Text>
      </View>
      <View style={tw`px-4 gap-4`}>
        {stats && <LifetimeXPBanner xp={stats.lifetime_xp} todayXp={todayXp} stats={stats} />}
        {history && history.length > 0 && (
          <XPBarChart history={history} playToken={playToken} range={range} onRangeChange={setRange} />
        )}
        {mastery && mastery.length > 0 && (
          <MasteryRadar data={mastery} playToken={playToken} />
        )}
      </View>
    </ScrollView>
  );
}
