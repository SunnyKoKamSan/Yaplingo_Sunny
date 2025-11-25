import React, { useEffect, useMemo, useRef } from "react";
import { Dimensions, Pressable, ScrollView, ScrollViewProps, View } from "react-native";
import tw from "twrnc";

import Text from "~/components/Text";

const WINDOW_WIDTH = Dimensions.get("window").width;

type Entry = { date: Date; count: number };

export default function Heatmap({
  entries = [],
  weeksShown = 20,
  squareGap = 4,
  squareSize = (WINDOW_WIDTH - 40) / weeksShown - squareGap,
  onCellPress,
  ...props
}: {
  entries?: Entry[];
  weeksShown?: number;
  squareGap?: number;
  squareSize?: number;
  onCellPress?: (entry: Entry) => void;
} & ScrollViewProps) {
  const ref = useRef<ScrollView>(null);

  const weeks = useMemo(() => {
    const today = new Date();
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + (6 - today.getDay()));
    const weeks = [];
    for (let w = 0; w < weeksShown; w++) {
      const weekSaturday = new Date(saturday);
      weekSaturday.setDate(saturday.getDate() - w * 7);
      const sunday = new Date(weekSaturday);
      sunday.setDate(weekSaturday.getDate() - 6);

      const week: { month: string; days: Entry[] } = {
        month: weekSaturday.toLocaleDateString("en-GB", { month: "short" }),
        days: [],
      };
      for (let d = 0; d < 7; d++) {
        const date = new Date(sunday);
        date.setDate(sunday.getDate() + d);
        if (date.getTime() > today.getTime()) break;
        const entry = entries.find((e) => e.date.toDateString() === date.toDateString());
        week.days.push({ date, count: entry?.count ?? 0 });
      }
      weeks.unshift(week);
    }
    return weeks;
  }, [entries, weeksShown]);

  useEffect(() => ref.current?.scrollToEnd({ animated: false }), []);

  return (
    <ScrollView ref={ref} horizontal={true} showsHorizontalScrollIndicator={false} {...props}>
      <View style={tw`gap-2`}>
        <View style={[tw`flex-row`, { gap: squareGap }]}>
          {weeks.map((week, index) => (
            <View key={index} style={{ gap: squareGap }}>
              {week.days.map((day) => {
                const intensity = Math.min(Math.ceil(day.count / 2) * 100, 900);
                const color = tw.color(`emerald-${intensity || 100}`);
                return (
                  <Pressable
                    onPress={() => onCellPress?.(day)}
                    key={day.date.getTime()}
                    style={[
                      tw`rounded-sm bg-zinc-200 dark:bg-zinc-800`,
                      { width: squareSize, height: squareSize },
                      day.count > 0 && { backgroundColor: color },
                    ]}
                  />
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
