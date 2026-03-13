import React, { useEffect, useMemo, useRef } from "react";
import { ScrollView, useColorScheme, View, type ScrollViewProps } from "react-native";
import tw from "twrnc";

import Text from "./Text";
import Tooltip from "./Tooltip";

type Entry = { date: Date; count: number };
const LOCAL_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function Heatmap({
  entries = {},
  squareGap = 4,
  squareSize = 16,
  ...props
}: {
  entries?: Record<string, number>;
  squareGap?: number;
  squareSize?: number;
} & ScrollViewProps) {
  const scheme = useColorScheme();

  const ref = useRef<ScrollView>(null);
  const normalizedEntries = useMemo(() => {
    const mapped: Record<string, number> = {};
    for (const [key, count] of Object.entries(entries)) {
      if (LOCAL_DATE_KEY_PATTERN.test(key)) {
        mapped[key] = count;
        continue;
      }
      const parsed = new Date(key);
      if (!Number.isNaN(parsed.getTime())) {
        mapped[toLocalDateKey(parsed)] = count;
      }
    }
    return mapped;
  }, [entries]);

  const weeks = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 1);
    const sunday = new Date(start);
    sunday.setDate(start.getDate() - start.getDay());

    const weeks = [];
    const weekstart = new Date(sunday);

    while (weekstart <= today) {
      const weekend = new Date(weekstart);
      weekend.setDate(weekstart.getDate() + 6);
      const week: { month: string; days: Entry[] } = {
        month: weekend.toLocaleDateString("en-GB", { month: "short" }),
        days: [],
      };
      for (let d = 0; d < 7; d++) {
        const date = new Date(weekstart);
        date.setDate(weekstart.getDate() + d);
        if (date.getTime() > today.getTime()) break;
        const count = normalizedEntries[toLocalDateKey(date)] ?? 0;
        week.days.push({ date, count });
      }
      weeks.push(week);
      weekstart.setDate(weekstart.getDate() + 7);
    }
    return weeks;
  }, [normalizedEntries]);

  useEffect(() => ref.current?.scrollToEnd({ animated: false }), []);

  return (
    <ScrollView ref={ref} horizontal={true} showsHorizontalScrollIndicator={false} {...props}>
      <View style={tw`gap-2`}>
        <View style={[tw`flex-row`, { gap: squareGap }]}>
          {weeks.map((week, index) => (
            <View key={index} style={{ gap: squareGap }}>
              {week.days.map((day) => {
                const intensity =
                  scheme === "dark"
                    ? Math.max(900 - Math.floor(day.count / 2) * 100, 100)
                    : Math.min(Math.ceil(day.count / 2) * 100, 900);
                const color = tw.color(`emerald-${intensity || 100}`);
                return (
                  <Tooltip
                    key={day.date.getTime()}
                    content={`${day.date.toLocaleDateString("en-GB", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}\n${day.count} activities`}>
                    {(active) => (
                      <View
                        style={[
                          tw.style("rounded bg-zinc-200 dark:bg-zinc-800", active && "border-2 border-zinc-500/50"),
                          { width: squareSize, height: squareSize },
                          day.count > 0 && { backgroundColor: color },
                        ]}
                      />
                    )}
                  </Tooltip>
                );
              })}
            </View>
          ))}
        </View>
        <View style={tw`flex-row`}>
          {weeks.map((week, index) => (
            <View key={index} style={[tw`flex-row`, { width: squareSize + squareGap }]}>
              {(index === 0 || week.month !== weeks[index - 1]?.month) && (
                <Text style={[tw`text-xs text-zinc-500`, { width: (squareSize + squareGap) * 2 }]} numberOfLines={1}>
                  {week.month}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
