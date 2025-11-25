import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { useAudioPlayer } from "expo-audio";
import { useLocalSearchParams } from "expo-router";
import tw from "twrnc";

import { useEchoResultQuery } from "~/client";
import { Text } from "~/components";

export default function MainLearnEchoFeedbackScreen() {
  const player = useAudioPlayer();
  const { tid } = useLocalSearchParams<{ tid: string }>();
  const { data: result, ...query } = useEchoResultQuery(tid);

  useEffect(() => {
    if (result) {
      player.replace(result.feedback.audio);
      player.seekTo(0);
      player.play();
    }
  }, [player, result]);

  const percentage = useMemo(() => {
    if (!result) return undefined;
    const scores = result.pronunciation.alignments.map((a) => a.score);
    const total = scores.reduce((a, b) => a + b, 0);
    return Math.round((total / scores.length) * 100);
  }, [result]);

  const color = useMemo(() => {
    if (!percentage) return undefined;
    if (percentage >= 75) return tw.color("green-500");
    if (percentage >= 50) return tw.color("yellow-500");
    return tw.color("red-500");
  }, [percentage]);

  const message = useMemo(() => {
    if (!percentage) return undefined;
    if (percentage >= 75) return "Great job!";
    if (percentage >= 50) return "Good effort!";
    return "Keep practicing!";
  }, [percentage]);

  if (!query.isSuccess || result === null) return null;

  return (
    <View style={tw`flex-1 gap-8 p-4`}>
      <View style={tw`mt-4 gap-2`}>
        <Text style={[tw`text-center text-5xl font-bold tracking-tighter`, { color }]}>{percentage}</Text>
        <Text style={[tw`text-center text-2xl font-medium`, { color }]}>{message}</Text>
      </View>
      <View style={tw`gap-2 rounded-2xl border-2 border-zinc-500/50 p-4`}>
        <Text style={tw`text-lg`}>{result?.feedback.text}</Text>
      </View>
    </View>
  );
}
