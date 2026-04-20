import { useEffect, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line, Rect } from "react-native-svg";
import { useIsFocused, useTheme } from "@react-navigation/native";
import {
  CalendarIcon,
  FlameIcon,
  RocketIcon,
  ShieldIcon,
  TargetIcon,
  TrendingUpIcon,
  ZapIcon,
} from "lucide-react-native";
import tw from "twrnc";

import { useCurrentUserQuery, useCurrentUserStatsQuery, type User, type UserStats } from "~/client";
import { Spinner, Text } from "~/components/primitives";
import { useCountdown, useSetNavigationOptions } from "~/hooks";
import { formatCompactNumber } from "~/utils";

import { ActivityCard, StreakCard } from "./profile";

const Header = ({ user }: { user?: User }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        tw`border-b pb-2`,
        {
          paddingTop: insets.top,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
      ]}>
      <View style={tw`h-10 flex-row items-center justify-between px-4`}>
        <View style={tw`flex-row items-center gap-1.5`}>
          <CalendarIcon size={18} strokeWidth={2.5} color={theme.colors.text} />
          <Text style={tw`text-lg font-medium`}>
            {new Date().toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
          </Text>
        </View>
        <View style={tw`absolute inset-x-0 items-center justify-center`}>
          <Text style={[tw`text-3xl leading-[0] text-green-500`, { fontFamily: "Feather-Bold" }]}>yaplingo</Text>
        </View>
        <View style={tw`flex-row items-center gap-1.5 rounded-full bg-sky-500/25 px-2.5 py-0.5`}>
          <ZapIcon size={16} color={tw.color("sky-500")} fill={tw.color("sky-500")} />
          <Text style={tw`text-lg font-bold tracking-tighter text-sky-500`}>
            {user ? formatCompactNumber(user.points.total) : "-"}
          </Text>
        </View>
      </View>
    </View>
  );
};

const MilestoneCard = ({ user }: { user: User }) => {
  const remaining = user.points.milestone - user.points.today;
  const progress = Math.round((user.points.today / user.points.milestone) * 100);

  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const countdown = useCountdown(midnight);

  return (
    <View style={tw`grow items-center justify-center gap-2 rounded-2xl border-2 border-zinc-500/50 p-4`}>
      {remaining > 0 ? (
        <View>
          <Text style={tw`text-center text-3xl font-bold tracking-tighter text-sky-500`}>{remaining} XP</Text>
          <Text style={tw`text-center text-base font-medium`}>to bump your streak</Text>
          {user.streak > 0 && (
            <Text style={tw`text-center text-sm font-medium text-neutral-500`}>streak resets at {countdown}</Text>
          )}
        </View>
      ) : (
        <View>
          <Text style={tw`text-center text-3xl font-bold tracking-tighter text-sky-500`}>
            {user.points.milestone} XP
          </Text>
          <Text style={tw`text-center text-lg font-medium`}>Completed</Text>
          <Text style={tw`text-center text-sm font-medium text-neutral-500`}>next milestone at {countdown}</Text>
        </View>
      )}
      <View style={tw`flex-row items-center justify-center gap-2`}>
        <Text style={tw`text-xs font-medium tracking-tighter text-neutral-500`}>0</Text>
        <View style={tw`w-32 items-stretch justify-center`}>
          <View style={tw`h-2.5 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800`}>
            <View style={[tw`h-full bg-sky-500`, { width: `${progress}%` }]} />
          </View>
        </View>
        <Text
          style={tw.style(
            "text-xs font-medium tracking-tighter text-neutral-500",
            user.points.today > user.points.milestone && "font-bold text-sky-500",
          )}>
          {Math.max(user.points.milestone, user.points.today)}
        </Text>
      </View>
    </View>
  );
};

const PointsBarChart = ({ entries, token }: { entries: UserStats["progress"][number][]; token: number }) => {
  const DAILY_GOAL_XP = 500;
  const CHART_HEIGHT = 200;
  const CHART_TOP_PAD = 24;
  const CHART_BOTTOM_PAD = 20;
  const CHART_BAR_AREA = CHART_HEIGHT - CHART_TOP_PAD - CHART_BOTTOM_PAD;

  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 48;

  const maxPoints = Math.max(...entries.map((e) => e.points), DAILY_GOAL_XP * 1.2);
  const scale = (points: number) => (points / maxPoints) * CHART_BAR_AREA;
  const goalY = CHART_TOP_PAD + CHART_BAR_AREA - scale(DAILY_GOAL_XP);

  const [selected, setSelected] = useState<number | null>(null);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  const easeOutBack = (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  useEffect(() => {
    setSelected(null);
    setAnimatedProgress(0);
    const start = Date.now();
    const duration = 800;
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      setAnimatedProgress(easeOutBack(t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [token]);

  const gap = 2;
  const barWidth = Math.max((chartWidth - gap * (entries.length - 1)) / entries.length, 2);

  const colorGoalMet = tw.color("orange-500")!;
  const colorActive = tw.color("amber-500")!;
  const colorInactive = tw.color("gray-500")!;

  return (
    <View style={tw`rounded-2xl border-2 border-zinc-500/50 px-4 py-2.5`}>
      <Text style={tw`text-2xl font-bold`}>Points</Text>

      <Svg width={chartWidth} height={CHART_HEIGHT}>
        <Line
          x1={0}
          y1={goalY}
          x2={chartWidth}
          y2={goalY}
          stroke={colorGoalMet}
          strokeWidth={1.5}
          strokeDasharray="6,4"
        />
        {entries.map((entry, i) => {
          const fullH = Math.max(scale(entry.points), 2);
          const barH = fullH * Math.max(animatedProgress, 0);
          const x = i * (barWidth + gap);
          const y = CHART_TOP_PAD + CHART_BAR_AREA - barH;
          const fill = entry.points > DAILY_GOAL_XP ? colorGoalMet : entry.points > 0 ? colorActive : colorInactive;
          return (
            <Rect
              key={entry.date}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={barWidth > 4 ? 3 : 1}
              fill={fill}
              opacity={selected === null || selected === i ? 1 : 0.35}
              onPress={() => setSelected(i === selected ? null : i)}
            />
          );
        })}
      </Svg>

      {/* Tooltip */}
      {selected !== null && (
        <View
          style={[
            tw`absolute z-10 items-center rounded-xl bg-slate-800 px-3 py-1.5 shadow-sm`,
            {
              top: 36,
              left: Math.min(Math.max(selected * (barWidth + gap) + barWidth / 2 - 50, 16), chartWidth - 96),
            },
          ]}>
          <Text style={tw`text-xs text-zinc-300`}>{entries[selected].date}</Text>
          <Text style={tw`text-sm font-bold text-white`}>{entries[selected].points} XP</Text>
        </View>
      )}

      {/* Legend */}
      <View style={tw`mt-2 flex-row justify-center gap-4`}>
        <View style={tw`flex-row items-center gap-1`}>
          <View style={tw`h-3 w-3 rounded-sm bg-orange-500`} />
          <Text style={tw`text-xs text-neutral-500`}>Met</Text>
        </View>
        <View style={tw`flex-row items-center gap-1`}>
          <View style={tw`h-3 w-3 rounded-sm bg-amber-500`} />
          <Text style={tw`text-xs text-neutral-500`}>Unmet</Text>
        </View>
        <View style={tw`flex-row items-center gap-1`}>
          <Svg width={20} height={12}>
            <Line x1={0} y1={6} x2={20} y2={6} stroke={colorGoalMet} strokeWidth={2} strokeDasharray="4,3" />
          </Svg>
          <Text style={tw`text-xs text-neutral-500`}>Goal ({DAILY_GOAL_XP})</Text>
        </View>
      </View>
    </View>
  );
};

const StatCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <View style={tw`flex-1 items-center gap-0.5 rounded-xl bg-green-600/20 px-2 py-3`}>
    {icon}
    <Text style={tw`text-xl font-bold text-green-800 dark:text-green-200`}>{value}</Text>
    <Text style={tw`text-center text-sm font-medium text-green-700/70 dark:text-green-300/70`}>{label}</Text>
  </View>
);

const PointsBanner = ({ stats }: { stats: UserStats }) => {
  const [tab, setTab] = useState<"30d" | "today">("30d");

  const isToday = tab === "today";
  const todayPoints = stats.progress.find((h) => h.date === new Date().toISOString().slice(0, 10))?.points ?? 0;
  const displayPoints = isToday ? todayPoints : stats.total_points_30d;

  return (
    <View style={tw`min-h-58 overflow-hidden rounded-2xl border-2 border-zinc-500/50`}>
      <View style={tw`flex-row border-b border-zinc-500/50`}>
        {(["30d", "today"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[tw`flex-1 items-center py-3`, t === tab && tw`-mb-px border-b-2 border-green-500`]}>
            <Text style={tw.style("text-sm font-bold uppercase", t === tab ? "text-green-600" : "text-zinc-500")}>
              {t === "30d" ? "Last 30 Days" : "Today"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={tw`flex-row items-center justify-between px-5 py-5`}>
        <View style={tw`flex-row items-center gap-3`}>
          <View style={tw`h-10 w-10 items-center justify-center rounded-xl bg-green-500/15`}>
            <ZapIcon size={22} color={tw.color("green-500")} fill={tw.color("green-500")} />
          </View>
          <View>
            <Text style={tw`text-xs font-medium text-green-700/70 dark:text-green-300/70`}>Earned</Text>
            <Text style={tw`text-2xl font-bold text-green-800 dark:text-green-200`}>
              {displayPoints.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      <View style={tw`flex-row gap-2 px-3 pb-3`}>
        <StatCard
          label="7D Average"
          value={`${Math.round(stats.average_points_7d)}`}
          icon={<TrendingUpIcon size={16} color={tw.color("green-500")} />}
        />
        <StatCard
          label="Best Streak"
          value={`${stats.best_streak_30d}d`}
          icon={<FlameIcon size={16} color={tw.color("orange-500")} fill={tw.color("orange-500")} />}
        />
        <StatCard
          label="Completion"
          value={`${Math.round(stats.completion_rate_30d)}%`}
          icon={<TargetIcon size={16} color={tw.color("green-500")} />}
        />
      </View>
    </View>
  );
};

export const ActiveCard = ({ user }: { user?: User }) => {
  const expiry = user?.boost ? new Date(user.boost.expiry * 1000) : null;
  const countdown = useCountdown(expiry);
  return (
    <View style={tw`gap-2`}>
      <View style={tw`flex-row items-center gap-4 rounded-xl border-2 border-zinc-500/50 px-2.5 py-2`}>
        <View
          style={tw.style(
            "size-10 items-center justify-center rounded-full",
            user?.boost ? "bg-orange-500/25" : "bg-neutral-500/25",
          )}>
          <RocketIcon size={20} color={user?.boost ? tw.color("orange-500") : tw.color("neutral-500")} />
        </View>
        <View>
          <Text style={tw`text-base font-medium`}>
            {user?.boost ? `${user.boost.multiplier}x XP Boost` : "No Active Boost"}
          </Text>
          {user?.boost && <Text style={tw`text-sm font-medium text-neutral-500`}>{countdown} remaining</Text>}
        </View>
        {user?.boost && (
          <View style={tw`ml-auto rounded-lg bg-orange-500/25 px-2.5 py-0.5`}>
            <Text style={tw`font-medium text-orange-500`}>Active</Text>
          </View>
        )}
      </View>
      <View style={tw`flex-row items-center gap-4 rounded-xl border-2 border-zinc-500/50 px-2.5 py-2`}>
        <View style={tw`size-10 items-center justify-center rounded-full bg-neutral-500/25`}>
          <ShieldIcon size={20} color={tw.color("neutral-500")} />
        </View>
        <View>
          <Text style={tw`text-base font-medium`}>You have {user ? user.streak_freezes : 0} streak freezes.</Text>
          <Text style={tw`text-sm font-medium text-neutral-500`}>Automatically consumed when streak is broken.</Text>
        </View>
      </View>
    </View>
  );
};

export default function MainHomeScreen() {
  const focused = useIsFocused();
  const { data: user } = useCurrentUserQuery();
  const { data: stats, isLoading: statsLoading } = useCurrentUserStatsQuery();
  const [animationToken, setAnimationToken] = useState(Math.random());

  useSetNavigationOptions({ header: () => <Header user={user} /> });

  useEffect(() => {
    if (!focused) return;
    setAnimationToken(Math.random());
  }, [focused]);

  if (!user) {
    return (
      <View style={tw`flex-1 items-center justify-center`}>
        <Spinner size={36} />
      </View>
    );
  }

  return (
    <ScrollView alwaysBounceVertical={false} contentContainerStyle={tw`gap-4 p-4`}>
      <View style={tw`flex-row gap-4`}>
        <StreakCard user={user} />
        <MilestoneCard user={user} />
      </View>
      <ActiveCard user={user} />
      <ActivityCard user={user} />
      {statsLoading && (
        <View style={tw`items-center py-8`}>
          <Spinner size={36} />
        </View>
      )}
      {stats && (
        <>
          <PointsBanner stats={stats} />
          {stats.progress.length > 0 && <PointsBarChart entries={stats.progress} token={animationToken} />}
        </>
      )}
    </ScrollView>
  );
}
