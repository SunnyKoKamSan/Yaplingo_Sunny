import { useEffect, useRef, useState } from "react";
import { View, Text as RNText, type LayoutChangeEvent, type ViewProps } from "react-native";
import { UserIcon } from "lucide-react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from "react-native-svg";
import tw from "twrnc";

import Text from "./primitives/Text";

type PodiumRank = 1 | 2 | 3;
type PodiumEntry = { name: string; xpLabel: string };
export type PodiumEntries = Partial<Record<PodiumRank, PodiumEntry>>;

const W = 500, H = 300, GROUND = 250, SCALE = 1.16, EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const LAYOUT: Record<PodiumRank, { x: number; w: number; h: number; y: number; grad: [string, string] }> = {
  1: { x: 250, w: 80, h: 160, y: 110, grad: ["#3eec17", "#247843"] },
  2: { x: 130, w: 80, h: 130, y: 140, grad: ["#3decac", "#1d7454"] },
  3: { x: 370, w: 80, h: 100, y: 170, grad: ["#11d597", "#02422e"] },
};

export default function AnimatedPodium({ entries, playToken, championContent, style, ...props }: { entries: PodiumEntries; playToken: number; championContent?: React.ReactNode } & ViewProps) {
  const [width, setWidth] = useState(0);
  const lastToken = useRef<number | null>(null);
  const s = width > 0 ? (width / W) * SCALE : 1;
  const sw = width > 0 ? W * s : W, sh = width > 0 ? H * s : H, ox = width > 0 ? (width - sw) / 2 : 0;
  const hasEntry = !!(entries[1] || entries[2] || entries[3]);

  const y1 = useSharedValue(GROUND), y2 = useSharedValue(GROUND), y3 = useSharedValue(GROUND);
  const sx = useSharedValue(0), sy = useSharedValue(0), sr = useSharedValue(0);

  useEffect(() => {
    if (!hasEntry || lastToken.current === playToken) return;
    lastToken.current = playToken;
    y1.value = y2.value = y3.value = GROUND;
    sx.value = sy.value = sr.value = 0;

    const rise = (sv: SharedValue<number>, d: number, t: number, f: number) => {
      sv.value = withDelay(d, withSequence(withTiming(t, { duration: 420, easing: EASE }), withTiming(f, { duration: 180, easing: EASE })));
    };
    if (entries[3]) rise(y3, 500, 160, 170);
    if (entries[2]) rise(y2, 1300, 130, 140);
    if (entries[1]) {
      y1.value = withDelay(2200, withSequence(
        withTiming(235, { duration: 220, easing: Easing.out(Easing.quad) }),
        withTiming(235, { duration: 900 }),
        withTiming(90, { duration: 300, easing: EASE }),
        withTiming(110, { duration: 220, easing: EASE })
      ));
      const shake = (sv: SharedValue<number>, vals: number[]) => {
        sv.value = withDelay(2600, withSequence(withRepeat(withSequence(...vals.map(v => withTiming(v, { duration: 50 }))), 3, false), withTiming(0, { duration: 40 })));
      };
      shake(sx, [3, -3, 1, -2]);
      shake(sy, [0, 2, -1]);
      shake(sr, [1, -1, 0.5, -0.5]);
    }
  }, [entries, hasEntry, playToken, y1, y2, y3, sx, sy, sr]);

  const as1 = useAnimatedStyle(() => ({ transform: [{ translateY: y1.value * s + sy.value * s }, { translateX: sx.value * s }, { rotate: `${sr.value}deg` }] }));
  const as2 = useAnimatedStyle(() => ({ transform: [{ translateY: y2.value * s }] }));
  const as3 = useAnimatedStyle(() => ({ transform: [{ translateY: y3.value * s }] }));

  const renderLabel = (r: PodiumRank) => {
    const e = entries[r]; if (!e) return null;
    const l = LAYOUT[r], left = l.x * s, lw = 118 * s, cs = Math.max(0.88, Math.min(s * 0.9, 1.05));
    const pt = l.y * s, ah = 40 * s, nh = 24 * s, xh = Math.max(10, 11 * s);
    const top = r === 1 && championContent ? pt - 86 - nh - xh - 8 * s : Math.max(pt - ah - nh - xh - 8 * s, 4);
    return (
      <View key={`l-${r}`} style={[tw`absolute items-center`, { left, top, width: lw, marginLeft: -lw / 2 }]}>
        {r === 1 && championContent ? (
          <View style={{ transform: [{ scale: cs }] }}>{championContent}</View>
        ) : (
          <View style={[tw`items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 border-2 border-white`, { width: ah, height: ah }]}>
            <UserIcon size={18 * s} color={tw.color("zinc-400")} />
          </View>
        )}
        <Text style={[tw`font-bold text-center`, { fontSize: Math.max(11, 12 * s), minHeight: nh }]} numberOfLines={2}>{e.name}</Text>
        <Text style={[tw`text-zinc-500`, { fontSize: Math.max(10, 11 * s) }]}>{e.xpLabel}</Text>
      </View>
    );
  };

  const renderPillar = (r: PodiumRank) => {
    const e = entries[r]; if (!e) return null;
    const l = LAYOUT[r], bw = l.w * s, bh = l.h * s, left = (l.x - l.w / 2) * s;
    const as = r === 1 ? as1 : r === 2 ? as2 : as3;
    const gradId = `pillar-grad-${r}`;
    return (
      <Animated.View key={`p-${r}`} style={[tw`absolute rounded-t-lg overflow-hidden`, { left, top: 0, width: bw, height: bh }, as]}>
        <Svg width="100%" height="100%" style={tw`absolute inset-0`}>
          <Defs>
            <SvgLinearGradient id={gradId} x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0" stopColor={l.grad[0]} stopOpacity="1" />
              <Stop offset="1" stopColor={l.grad[1]} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
        </Svg>
        <View style={tw`flex-1 items-center`}>
          <RNText style={[tw`font-bold`, { color: "#fff", fontSize: r === 1 ? Math.max(34, 48 * s) : Math.max(26, 32 * s), marginTop: r === 1 ? 36 * s : 20 * s }]}>{r}</RNText>
        </View>
      </Animated.View>
    );
  };

  if (!hasEntry) return null;
  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={[tw`w-full self-center`, { aspectRatio: W / (H * SCALE) }, style]} {...props}>
      <View pointerEvents="none" style={[tw`absolute top-0 overflow-hidden`, { left: ox, width: sw, height: GROUND * s }]}>{renderPillar(3)}{renderPillar(2)}{renderPillar(1)}</View>
      <View pointerEvents="none" style={[tw`absolute top-0`, { left: ox, width: sw, height: GROUND * s, overflow: "visible" as const }]}>{renderLabel(3)}{renderLabel(2)}{renderLabel(1)}</View>
      <Svg width={sw || "100%"} height={sh || "100%"} viewBox="0 0 500 300" style={[tw`absolute top-0`, { left: ox }]}>
        <Rect x="0" y="250" width="500" height="50" fill="#57534e" />
        <Path d="M0,250 Q25,246 50,250 T100,250 T150,247 T200,250 T250,245 T300,250 T350,248 T400,250 T450,246 T500,250 L500,256 L0,256 Z" fill="#44403c" />
      </Svg>
    </View>
  );
}
