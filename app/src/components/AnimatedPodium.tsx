import { useEffect, useRef, useState } from "react";
import { View, type LayoutChangeEvent, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { UserIcon } from "lucide-react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import tw from "twrnc";

import Text from "./Text";
import { Text as RNText } from "react-native";

type PodiumRank = 1 | 2 | 3;

type PodiumEntry = {
  name: string;
  xpLabel: string;
};

export type PodiumEntries = Partial<Record<PodiumRank, PodiumEntry>>;

const VIEWBOX_WIDTH = 500;
const VIEWBOX_HEIGHT = 300;
const GROUND_Y = 250;
const CONTENT_SCALE = 1.16;

const PODIUM_LAYOUT: Record<
  PodiumRank,
  {
    x: number;
    width: number;
    height: number;
    finalY: number;
    gradient: [string, string];
    rankColor: string;
  }
> = {
  1: {
    x: 250,
    width: 80,
    height: 160,
    finalY: 110,
    gradient: ["#3eec17", "#247843"],
    rankColor: "#ffffff",
  },
  2: {
    x: 130,
    width: 80,
    height: 130,
    finalY: 140,
    gradient: ["#3decac", "#1d7454"],
    rankColor: "#ffffff",
  },
  3: {
    x: 370,
    width: 80,
    height: 100,
    finalY: 170,
    gradient: ["#11d597", "#02422e"],
    rankColor: "#ffffff",
  },
};

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);
export default function AnimatedPodium({
  entries,
  playToken,
  championContent,
  style,
  ...props
}: {
  entries: PodiumEntries;
  playToken: number;
  championContent?: React.ReactNode;
} & ViewProps) {
  const [width, setWidth] = useState(0);
  const lastPlayedToken = useRef<number | null>(null);
  const scale = width > 0 ? (width / VIEWBOX_WIDTH) * CONTENT_SCALE : 1;
  const scaledWidth = width > 0 ? VIEWBOX_WIDTH * scale : VIEWBOX_WIDTH;
  const scaledHeight = width > 0 ? VIEWBOX_HEIGHT * scale : VIEWBOX_HEIGHT;
  const offsetX = width > 0 ? (width - scaledWidth) / 2 : 0;
  const height = scaledHeight;
  const clipHeight = GROUND_Y * scale;
  const hasAnyEntry = !!(entries[1] || entries[2] || entries[3]);

  const rank1Y = useSharedValue(GROUND_Y);
  const rank2Y = useSharedValue(GROUND_Y);
  const rank3Y = useSharedValue(GROUND_Y);
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  const shakeRotate = useSharedValue(0);

  useEffect(() => {
    if (!hasAnyEntry) return;
    if (lastPlayedToken.current === playToken) return;
    lastPlayedToken.current = playToken;

    rank1Y.value = GROUND_Y;
    rank2Y.value = GROUND_Y;
    rank3Y.value = GROUND_Y;
    shakeX.value = 0;
    shakeY.value = 0;
    shakeRotate.value = 0;

    if (entries[3]) {
      rank3Y.value = withDelay(
        500,
        withSequence(
          withTiming(160, { duration: 420, easing: EASE_OUT }),
          withTiming(170, { duration: 180, easing: EASE_OUT }),
        ),
      );
    }

    if (entries[2]) {
      rank2Y.value = withDelay(
        1300,
        withSequence(
          withTiming(130, { duration: 420, easing: EASE_OUT }),
          withTiming(140, { duration: 180, easing: EASE_OUT }),
        ),
      );
    }

    if (entries[1]) {
      rank1Y.value = withDelay(
        2200,
        withSequence(
          withTiming(235, { duration: 220, easing: Easing.out(Easing.quad) }),
          withTiming(235, { duration: 900 }),
          withTiming(90, { duration: 300, easing: EASE_OUT }),
          withTiming(110, { duration: 220, easing: EASE_OUT }),
        ),
      );

      shakeX.value = withDelay(
        2600,
        withSequence(
          withRepeat(
            withSequence(
              withTiming(3, { duration: 50 }),
              withTiming(-3, { duration: 50 }),
              withTiming(1, { duration: 50 }),
              withTiming(-2, { duration: 50 }),
            ),
            3,
            false,
          ),
          withTiming(0, { duration: 40 }),
        ),
      );
      shakeY.value = withDelay(
        2600,
        withSequence(
          withRepeat(
            withSequence(
              withTiming(0, { duration: 50 }),
              withTiming(2, { duration: 50 }),
              withTiming(-1, { duration: 50 }),
            ),
            4,
            false,
          ),
          withTiming(0, { duration: 40 }),
        ),
      );
      shakeRotate.value = withDelay(
        2600,
        withSequence(
          withRepeat(
            withSequence(
              withTiming(1, { duration: 50 }),
              withTiming(-1, { duration: 50 }),
              withTiming(0.5, { duration: 50 }),
              withTiming(-0.5, { duration: 50 }),
            ),
            3,
            false,
          ),
          withTiming(0, { duration: 40 }),
        ),
      );
    }
  }, [
    entries,
    hasAnyEntry,
    playToken,
    rank1Y,
    rank2Y,
    rank3Y,
    shakeRotate,
    shakeX,
    shakeY,
  ]);

  const rank1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: rank1Y.value * scale + shakeY.value * scale },
      { translateX: shakeX.value * scale },
      { rotate: `${shakeRotate.value}deg` },
    ],
  }));
  const rank2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rank2Y.value * scale }],
  }));
  const rank3AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rank3Y.value * scale }],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const renderLabel = (rank: PodiumRank) => {
    const entry = entries[rank];
    if (!entry) return null;
    const layout = PODIUM_LAYOUT[rank];
    const left = layout.x * scale;
    const championScale = Math.max(0.88, Math.min(scale * 0.9, 1.05));
    const labelWidth = 118 * scale;
    // compute label position based on pillar top and estimated label block height
    // so each rank preserves its own visual ratio to the podium
    const pillarTop = layout.finalY * scale;
    
    // Separate positioning logic for each rank
    let top: number;
    if (rank === 1 && championContent) {
      // FloatingMascot has fixed pixel layout: crown(70) -mb-9(36) + mascot(52) = 86px
      // The championScale transform is visual-only, layout stays 86px
      const championLayoutHeight = 86;
      const nameHeight = Math.max(12, 13 * scale);
      const nameMinHeight = 24 * scale;
      const xpHeight = Math.max(10, 11 * scale);
      const labelBlockHeight = championLayoutHeight + Math.max(nameMinHeight, nameHeight) + xpHeight;
      const gap = 8 * scale;
      // Allow negative top — parent overflow is visible so crown extends above container
      top = pillarTop - labelBlockHeight - gap;
    } else {
      const avatarHeight = 40 * scale;
      const nameHeight = Math.max(12, 13 * scale);
      const nameMinHeight = 24 * scale;
      const xpHeight = Math.max(10, 11 * scale);
      const labelBlockHeight = avatarHeight + Math.max(nameMinHeight, nameHeight) + xpHeight;
      const gap = 8 * scale;
      top = Math.max(pillarTop - labelBlockHeight - gap, 4);
    }

    return (
      <View
        key={`label-${rank}`}
        style={[
          tw`absolute items-center`,
          {
            left,
            top,
            width: labelWidth,
            marginLeft: -(labelWidth / 2),
          },
        ]}>
        {rank === 1 && championContent ? (
          <View style={[tw`items-center justify-center`, { transform: [{ scale: championScale }] }]}>
            {championContent}
          </View>
        ) : (
          <View
            style={[
              tw`items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 border-2 border-white`,
              { width: 40 * scale, height: 40 * scale },
            ]}>
            <UserIcon size={18 * scale} color={tw.color("zinc-400")} />
          </View>
        )}
        <Text
          style={[
            tw`font-bold text-center`,
            { fontSize: Math.max(11, 12 * scale), lineHeight: Math.max(12, 13 * scale), minHeight: 24 * scale },
          ]}
          numberOfLines={2}>
          {entry.name}
        </Text>
        <Text style={[tw`text-zinc-500`, { fontSize: Math.max(10, 11 * scale) }]}>
          {entry.xpLabel}
        </Text>
      </View>
    );
  };

  const renderPillar = (rank: PodiumRank) => {
    const entry = entries[rank];
    if (!entry) return null;

    const layout = PODIUM_LAYOUT[rank];
    const barWidth = layout.width * scale;
    const barHeight = layout.height * scale;
    const left = (layout.x - layout.width / 2) * scale;
    const animatedStyle = rank === 1 ? rank1AnimatedStyle : rank === 2 ? rank2AnimatedStyle : rank3AnimatedStyle;

    return (
      <Animated.View
        key={`pillar-${rank}`}
        style={[
          tw`absolute rounded-t-lg overflow-hidden`,
          {
            left,
            top: 0,
            width: barWidth,
            height: barHeight,
          },
          animatedStyle,
        ]}>
        <LinearGradient
          colors={layout.gradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={tw`flex-1 items-center`}>
          {/* Use RNText directly for the pillar number to avoid theming overrides and ensure color is applied */}
          <RNText
            style={[
              tw`font-bold`,
              {
                color: rank === 1 ? PODIUM_LAYOUT[1].rankColor : layout.rankColor,
                // Make the top-1 number larger and raise it higher on the pillar
                fontSize: rank === 1 ? Math.max(34, 48 * scale) : Math.max(26, 32 * scale),
                marginTop: rank === 1 ? 36 * scale : 20 * scale,
              },
            ]}>
            {rank}
          </RNText>
        </LinearGradient>
      </Animated.View>
    );
  };

  if (!hasAnyEntry) return null;

  return (
    <View
      onLayout={onLayout}
      style={[tw`w-full self-center`, { aspectRatio: VIEWBOX_WIDTH / (VIEWBOX_HEIGHT * CONTENT_SCALE) }, style]}
      {...props}>
      <View
        pointerEvents="none"
        style={[
          tw`absolute top-0 overflow-hidden`,
          { left: offsetX, width: scaledWidth, height: clipHeight },
        ]}>
        {renderPillar(3)}
        {renderPillar(2)}
        {renderPillar(1)}
      </View>

      <View
        pointerEvents="none"
        style={[tw`absolute top-0`, { left: offsetX, width: scaledWidth, height: clipHeight, overflow: 'visible' as const }]}>
        {renderLabel(3)}
        {renderLabel(2)}
        {renderLabel(1)}
      </View>

      <Svg
        width={scaledWidth || "100%"}
        height={height || "100%"}
        viewBox="0 0 500 300"
        style={[tw`absolute top-0`, { left: offsetX }]}>
        <Rect x="0" y="250" width="500" height="50" fill="#57534e" />
        <Path
          d="M0,250 Q25,246 50,250 T100,250 T150,247 T200,250 T250,245 T300,250 T350,248 T400,250 T450,246 T500,250 L500,256 L0,256 Z"
          fill="#44403c"
        />
      </Svg>
    </View>
  );
}
