import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "@react-navigation/native";
import Color from "color";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import tw from "twrnc";

import type { Pronunciation } from "~/client/models";
import { getScoreColor } from "~/utils";

import { Text } from "./primitives";

export default function PronunciationBreakdown({ pronunciation }: { pronunciation: Pronunciation }) {
  const theme = useTheme();

  const [selection, setSelection] = useState<number | null>(null);

  return (
    <View style={tw`gap-2.5`}>
      {pronunciation.words.map(([word, { score, phonemes, alignments }], index) => {
        const wordScore = score ?? alignments.reduce((a, b) => a + b.score, 0) / (alignments.length || 1);
        const color = getScoreColor(wordScore);
        return (
          <Pressable
            key={index}
            onPress={() => setSelection(selection === index ? null : index)}
            style={tw.style(
              "gap-2 rounded-2xl border px-4 py-2",
              selection === index ? "border-zinc-500" : "border-zinc-500/50",
              { backgroundColor: theme.colors.background },
            )}>
            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`flex-row items-center gap-4`}>
                <Text style={tw`text-lg font-bold`}>{word}</Text>
                <Text style={[tw`text-lg`, { color }]}>{Math.round(wordScore * 100)}%</Text>
              </View>
              {selection === index ? (
                <ChevronUp size={18} color={tw.color("zinc-500")} />
              ) : (
                <ChevronDown size={18} color={tw.color("zinc-500/50")} />
              )}
            </View>
            {selection === index && (
              <View style={tw`gap-1`}>
                <View style={tw`flex-row items-center gap-4`}>
                  <Text style={tw`text-base`}>Expected:</Text>
                  <View style={tw`flex-row items-center gap-0.5`}>
                    {alignments.map(({ token, score }, key) => (
                      <View
                        key={key}
                        style={[
                          tw`rounded px-1 py-0.5`,
                          { backgroundColor: Color(getScoreColor(score)).alpha(0.5).toString() },
                        ]}>
                        <Text style={[tw`text-base`, { fontFamily: "" }]}>{token}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={tw`flex-row items-center gap-4`}>
                  <Text style={tw`text-base`}>Predicted:</Text>
                  <View style={tw`flex-row items-center gap-0.5`}>
                    {phonemes.map((token, key) => (
                      <View key={key} style={tw`rounded bg-zinc-500/50 px-1 py-0.5`}>
                        <Text style={[tw`text-base`, { fontFamily: "" }]}>{token}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
