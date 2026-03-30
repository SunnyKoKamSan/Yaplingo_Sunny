import React, { useCallback, useState } from "react";
import { Alert, FlatList, Image, Modal, Pressable, View } from "react-native";
import Animated, { FadeIn, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, runOnJS } from "react-native-reanimated";
import { AwardIcon } from "lucide-react-native";
import tw from "twrnc";
import { useClaimAchievementMutation } from "~/client";
import type { AchievementResponse } from "~/client/models";
import { BADGE_CONFIG, type BadgeConfig } from "~/config/badges";
import Text from "./Text";

const BADGE_SIZE = 72, BADGE_ICON = 32, MODAL_ICON = 46;
const GEM_ICON = require("../../assets/gem.png");

const BadgeIcon = ({ cfg, size, dim = false }: { cfg?: BadgeConfig; size: number; dim?: boolean }) => {
  if (!cfg) return <AwardIcon size={size} color="#9CA3AF" strokeWidth={2} opacity={dim ? 0.35 : 1} />;
  const sz = size * (cfg.iconScale ?? 1);
  return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}><Image source={cfg.icon} resizeMode="contain" style={{ width: sz, height: sz, opacity: dim ? 0.35 : 1 }} /></View>;
};

const FlyingGem = ({ i, done }: { i: number; done: () => void }) => {
  const ty = useSharedValue(0), tx = useSharedValue(0), op = useSharedValue(1), sc = useSharedValue(0.3);
  const sx = (Math.random() - 0.5) * 60;
  React.useEffect(() => {
    tx.value = withSequence(withTiming(sx, { duration: 100 }), withTiming(0, { duration: 600 }));
    ty.value = withDelay(i * 80, withTiming(-280, { duration: 800 }));
    sc.value = withDelay(i * 80, withSequence(withSpring(1.2, { damping: 4 }), withTiming(0.5, { duration: 400 })));
    op.value = withDelay(i * 80 + 500, withTiming(0, { duration: 300 }, () => { if (i === 0) runOnJS(done)(); }));
  }, [i, done, op, sc, sx, tx, ty]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }], opacity: op.value }));
  return <Animated.View style={[{ position: "absolute" }, style]}><Image source={GEM_ICON} resizeMode="contain" style={{ width: 20, height: 20 }} /></Animated.View>;
};

const Badge = ({ item, index, onPress }: { item: AchievementResponse; index: number; onPress: () => void }) => {
  const cfg = BADGE_CONFIG[item.key], pct = Math.round(item.progress * 100);
  const claimable = !item.unlocked && pct >= 100, locked = !item.unlocked && !claimable, ult = item.ultimate;
  const entering = item.unlocked ? ZoomIn.delay(index * 40).duration(250) : FadeIn.delay(index * 25).duration(200);
  const borderColor = item.unlocked ? (cfg?.color ?? "#9CA3AF") : claimable ? "#22C55E" : "#D1D5DB";
  const bgColor = item.unlocked ? `${cfg?.color ?? "#9CA3AF"}15` : claimable ? "#22C55E10" : "#F9FAFB";

  return (
    <Animated.View entering={entering} style={tw`flex-1 items-center py-2.5 px-1`}>
      <Pressable onPress={onPress} style={tw`items-center`}>
        <View style={[{ width: BADGE_SIZE, height: BADGE_SIZE, borderRadius: BADGE_SIZE / 2, borderWidth: ult ? 3.5 : item.unlocked ? 3 : 2, borderColor, backgroundColor: bgColor, alignItems: "center", justifyContent: "center" },
          item.unlocked && { shadowColor: cfg?.color ?? "#9CA3AF", shadowOffset: { width: 0, height: 2 }, shadowOpacity: ult ? 0.7 : 0.4, shadowRadius: ult ? 16 : 10, elevation: ult ? 12 : 8 },
          claimable && { shadowColor: "#22C55E", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
          ult && !item.unlocked && !claimable && { borderColor: "#FFD70060", borderWidth: 2.5 }]}>
          <BadgeIcon cfg={cfg} size={BADGE_ICON} dim={locked} />
        </View>
        <Text style={tw.style("text-[11px] font-bold text-center mt-1.5", item.unlocked ? "text-zinc-800 dark:text-zinc-100" : claimable ? "text-green-600" : "text-zinc-400")} numberOfLines={1}>{item.title}</Text>
        {!item.unlocked && <View style={tw`w-14 h-1.5 rounded-full mt-1 overflow-hidden bg-zinc-200 dark:bg-zinc-700`}><View style={[tw`h-full rounded-full`, { width: `${pct}%`, backgroundColor: claimable ? "#22C55E" : pct > 0 ? (cfg?.color ?? "#9CA3AF") : "transparent" }]} /></View>}
        {item.unlocked ? <View style={[tw`mt-1 rounded-full px-2 py-0.5`, { backgroundColor: `${cfg?.color ?? "#9CA3AF"}18` }]}><Text style={[tw`text-[9px] font-bold`, { color: cfg?.color ?? "#9CA3AF" }]}>✓ Earned</Text></View>
          : claimable ? <View style={tw`mt-1 rounded-full bg-green-500 px-2 py-0.5`}><Text style={tw`text-[9px] font-bold text-white`}>Collect!</Text></View>
          : pct > 0 ? <Text style={tw`text-[9px] font-medium text-zinc-400 mt-1`}>{pct}%</Text>
          : <Text style={tw`text-[9px] font-medium text-zinc-300 dark:text-zinc-600 mt-1`}>Locked</Text>}
      </Pressable>
    </Animated.View>
  );
};

const DetailModal = ({ item, onClose, onClaim, claiming }: { item: AchievementResponse | null; onClose: () => void; onClaim: (k: string) => void; claiming: boolean }) => {
  const [gems, setGems] = useState(false);
  if (!item) return null;
  const cfg = BADGE_CONFIG[item.key], pct = Math.round(item.progress * 100);
  const claimable = !item.unlocked && pct >= 100, locked = !item.unlocked && !claimable;
  const msg = item.unlocked ? `Earned ${new Date(item.unlocked_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
    : claimable ? "🎉 Achievement complete! Collect your reward!" : pct >= 75 ? "Almost there!" : pct >= 50 ? "Halfway through!" : pct > 0 ? "Keep it up!" : "Start practicing.";
  const borderColor = item.unlocked ? (cfg?.color ?? "#9CA3AF") : claimable ? "#22C55E" : "#D1D5DB";
  const bgColor = item.unlocked ? `${cfg?.color ?? "#9CA3AF"}15` : claimable ? "#22C55E10" : "#F3F4F6";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={tw`flex-1 items-center justify-center bg-black/50`} onPress={onClose}>
        <Pressable style={tw`mx-6 w-80 rounded-3xl bg-white dark:bg-zinc-900 p-6 items-center shadow-2xl`} onPress={() => {}}>
          <View style={[{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor, backgroundColor: bgColor, alignItems: "center", justifyContent: "center", marginBottom: 16 },
            (item.unlocked || claimable) && { shadowColor: item.unlocked ? (cfg?.color ?? "#9CA3AF") : "#22C55E", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 16 }]}>
            <BadgeIcon cfg={cfg} size={MODAL_ICON} dim={locked} />
          </View>
          {gems && <View style={{ position: "absolute", top: 60, alignSelf: "center" }}>{[0, 1, 2, 3, 4].map(i => <FlyingGem key={i} i={i} done={() => setGems(false)} />)}</View>}
          <Text style={tw`text-xl font-bold text-center text-zinc-800 dark:text-zinc-100`}>{item.title}</Text>
          <Text style={tw`text-sm text-center text-zinc-500 mt-1`}>{item.desc}</Text>
          <View style={tw`w-full mt-4`}>
            <View style={tw`flex-row justify-between mb-1.5`}>
              <Text style={tw`text-xs font-medium text-zinc-400`}>Progress</Text>
              <Text style={[tw`text-xs font-bold`, { color: item.unlocked || claimable ? "#22C55E" : (cfg?.color ?? "#9CA3AF") }]}>{pct}%</Text>
            </View>
            <View style={tw`h-2.5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800`}><View style={[tw`h-full rounded-full`, { width: `${pct}%`, backgroundColor: item.unlocked ? (cfg?.color ?? "#9CA3AF") : "#22C55E" }]} /></View>
          </View>
          <Text style={tw.style("text-xs text-center mt-3 font-medium", item.unlocked ? "text-zinc-500" : claimable ? "text-green-600" : "text-zinc-400")}>{msg}</Text>
          <View style={tw`flex-row items-center gap-1 mt-2`}><Text style={tw`text-xs text-zinc-400`}>Reward:</Text><Image source={GEM_ICON} resizeMode="contain" style={{ width: 12, height: 12 }} /><Text style={tw`text-xs font-bold text-green-600`}>{item.gem_reward} gems</Text></View>
          <Pressable onPress={claimable ? () => { setGems(true); onClaim(item.key); } : onClose} disabled={claimable && claiming}
            style={({ pressed }) => [tw`mt-4 px-8 py-3 rounded-full flex-row items-center justify-center gap-2`, { backgroundColor: "#FFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, transform: [{ scale: pressed ? 0.96 : 1 }], opacity: claiming ? 0.6 : 1 }]}>
            {claimable && <Image source={GEM_ICON} resizeMode="contain" style={{ width: 16, height: 16 }} />}
            <Text style={tw`text-sm font-bold ${claimable ? "text-green-600" : "text-zinc-600"}`}>{claimable ? (claiming ? "Claiming..." : `Collect ${item.gem_reward}`) : "Close"}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default function AchievementGrid({ achievements }: { achievements: AchievementResponse[] }) {
  const [selected, setSelected] = useState<AchievementResponse | null>(null);
  const claimMutation = useClaimAchievementMutation();
  const handleClaim = useCallback((key: string) => {
    claimMutation.mutate({ achievement_key: key }, {
      onSuccess: (data) => { Alert.alert("Collected", `+${data.gems_awarded} gems added.`); setTimeout(() => setSelected(null), 1200); },
      onError: () => Alert.alert("Error", "Could not claim. Try again."),
    });
  }, [claimMutation]);
  const renderItem = useCallback(({ item, index }: { item: AchievementResponse; index: number }) => <Badge item={item} index={index} onPress={() => setSelected(item)} />, []);
  const unlocked = achievements.filter(a => a.unlocked).length, claimable = achievements.filter(a => !a.unlocked && a.progress >= 1.0).length;

  return (
    <>
      <View style={tw`flex-row items-center justify-between mb-2 px-1`}>
        <Text style={tw`text-xl font-bold text-zinc-800 dark:text-zinc-100`}>🏅 Achievements</Text>
        <View style={tw`flex-row items-center gap-2`}>
          {claimable > 0 && <View style={tw`rounded-full bg-green-500 px-2 py-0.5`}><Text style={tw`text-[10px] font-bold text-white`}>{claimable} to collect</Text></View>}
          <View style={tw`rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5`}><Text style={tw`text-xs font-bold text-zinc-600 dark:text-zinc-300`}>{unlocked}/{achievements.length}</Text></View>
        </View>
      </View>
      <FlatList data={achievements} renderItem={renderItem} keyExtractor={item => item.key} numColumns={3} scrollEnabled={false} contentContainerStyle={tw`px-0.5`} />
      <DetailModal item={selected} onClose={() => setSelected(null)} onClaim={handleClaim} claiming={claimMutation.isPending} />
    </>
  );
}
