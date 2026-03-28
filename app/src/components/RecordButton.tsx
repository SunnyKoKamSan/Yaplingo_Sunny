import { useCallback } from "react";
import { Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { AudioLinesIcon, MicIcon } from "lucide-react-native";
import tw from "twrnc";

import type { UseAudio } from "~/hooks/useAudio";

import { Spinner, Text } from "./primitives";

export default function RecordButton({
  audio,
  isPending,
  pendingText,
  onSubmit,
}: {
  audio: UseAudio;
  isPending: boolean;
  pendingText: string;
  onSubmit: (data: string) => void;
}) {
  const handleLongPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    await audio.startRecording();
  }, [audio]);

  const handlePressOut = useCallback(async () => {
    const data = await audio.stopRecording();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (data) onSubmit(data);
  }, [audio, onSubmit]);

  return (
    <>
      <Pressable
        style={({ pressed }) =>
          tw.style(
            "rounded-full p-4",
            pressed && "opacity-80",
            !isPending ? (audio.recorderState.isRecording ? "bg-red-500" : "bg-green-500") : "bg-transparent",
          )
        }
        onLongPress={handleLongPress}
        onPressOut={handlePressOut}
        disabled={isPending}>
        {!isPending ? (
          audio.recorderState.isRecording ? (
            <AudioLinesIcon color="white" size={32} />
          ) : (
            <MicIcon color="white" size={32} />
          )
        ) : (
          <Spinner size={36} />
        )}
      </Pressable>
      <Text style={tw.style("absolute bottom-0 text-sm font-medium", isPending && "text-neutral-500")}>
        {isPending ? pendingText : !audio.recorderState.isRecording ? "Hold to Speak" : ""}
      </Text>
    </>
  );
}
