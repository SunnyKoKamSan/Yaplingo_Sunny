import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import {
  AudioQuality,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from "expo-audio";
import { useRouter } from "expo-router";
import {
  ArrowRightIcon,
  AudioLinesIcon,
  CheckIcon,
  EarIcon,
  FlipHorizontalIcon,
  MicIcon,
  RedoIcon,
  XIcon,
} from "lucide-react-native";
import tw from "twrnc";

import { useEchoMutation, useEchoResultQuery, useEchoTranscriptsQuery } from "~/client";
import type { Transcript } from "~/client/models";
import { Spinner, Text } from "~/components";
import { useNavigationOptions } from "~/hooks";
import { getLocalFileBase64 } from "~/utils";

const RECORDING_DURATION_THRESHOLD = 1500; // ms

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const RECORDING_OPTIONS: RecordingOptions = {
  extension: ".wav",
  bitRate: 128_000,
  sampleRate: 48_000,
  numberOfChannels: 1,
  ios: {
    extension: ".wav",
    outputFormat: "lpcm",
    audioQuality: AudioQuality.HIGH,
  },
  android: {
    outputFormat: "aac_adts",
    audioEncoder: "aac",
  },
};

const Header = ({
  attempted,
  transcript,
  progress,
  onProgress,
  disableProgress,
}: {
  attempted: boolean;
  transcript?: Transcript;
  progress: number;
  onProgress: () => void;
  disableProgress: boolean;
}) => {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: transcripts, ...queryTranscripts } = useEchoTranscriptsQuery();

  return (
    <>
      <View
        style={[
          tw`flex-row items-center justify-between px-4 pb-2`,
          { paddingTop: insets.top, backgroundColor: theme.colors.card },
        ]}>
        <Pressable onPress={() => router.dismiss()} style={({ pressed }) => tw.style(pressed && "opacity-50")}>
          <XIcon color={tw.color("neutral-500")} size={26} strokeWidth={2.5} />
        </Pressable>
        <View style={[tw`absolute inset-x-0 items-center justify-center`, { top: insets.top }]}>
          {queryTranscripts.isFetching ? (
            <Text style={tw`text-2xl font-bold leading-[0]`}>Generating...</Text>
          ) : (
            queryTranscripts.isSuccess && (
              <Text style={tw`text-2xl font-bold leading-[0]`}>
                Echoing on {<Text style={tw`font-bold text-amber-500`}>#{transcripts!.topic}</Text>}
              </Text>
            )
          )}
        </View>
        {!disableProgress && (
          <Pressable onPress={() => onProgress()} style={({ pressed }) => tw.style(pressed && "opacity-50")}>
            {attempted ? (
              progress + 1 === transcripts?.items.length ? (
                <CheckIcon color={tw.color("green-500")} size={26} strokeWidth={2.5} />
              ) : (
                <ArrowRightIcon color={tw.color("green-500")} size={26} strokeWidth={2.5} />
              )
            ) : (
              <RedoIcon color={tw.color("red-500")} size={26} strokeWidth={2.5} />
            )}
          </Pressable>
        )}
      </View>
      <View style={[tw`flex-row gap-1.5 px-2 pb-2 pt-1.5`, { backgroundColor: theme.colors.card }]}>
        {Array.from({ length: 5 }).map((_, index) => (
          <View
            key={index}
            style={tw.style("h-1.5 flex-1 rounded-full", {
              backgroundColor: !!transcript && index <= progress ? tw.color("sky-500") : theme.colors.border,
            })}
          />
        ))}
      </View>
    </>
  );
};

// FIXME: handle query/mutation errors
export default function MainLearnEchoScreen() {
  const router = useRouter();
  const player = useAudioPlayer();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder);

  const flipped = useSharedValue(false);
  const [_flipped, setFlipped] = useState(false);
  const [height, setHeight] = useState(0);
  const [progress, setProgress] = useState(0);

  useAnimatedReaction(
    () => flipped.value,
    (value) => runOnJS(setFlipped)(value),
  );

  const { data: transcripts, refetch: refetchTranscripts, ...queryTranscripts } = useEchoTranscriptsQuery();

  const transcript = useMemo(
    () => (!queryTranscripts.isFetching ? transcripts?.items[progress] : undefined),
    [progress, transcripts, queryTranscripts.isFetching],
  );

  const { reset: resetMutation, ...mutation } = useEchoMutation(transcript?.id);
  const queryResult = useEchoResultQuery(mutation.isSuccess ? transcript?.id : undefined);

  const handleNext = () => {
    if (progress < transcripts!.items.length - 1) {
      resetMutation();
      player.replace("");
      flipped.value = false;
      setProgress((prev) => prev + 1);
    } else {
      router.dismiss();
    }
  };

  const handleProgress = () => {
    if (queryResult.isSuccess) {
      handleNext();
    } else {
      Alert.alert("Relinquish", "Are you sure you want to relinquish this attempt?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Relinquish",
          style: "destructive",
          onPress: handleNext,
        },
      ]);
    }
  };

  useNavigationOptions({
    header: () => (
      <Header
        attempted={queryResult.isSuccess}
        transcript={transcript}
        progress={progress}
        onProgress={handleProgress}
        disableProgress={queryTranscripts.isFetching || queryResult.isLoading || recorderState.isRecording}
      />
    ),
  });

  // handle result once available
  useEffect(() => {
    if (queryResult.isSuccess) {
      if (queryResult.data == null) {
        resetMutation();
        Alert.alert("Speak Up!", "We couldn't hear you. Try to speak louder and clearer.");
      } else {
        router.navigate(
          {
            pathname: "./feedback",
            params: { tid: transcript?.id },
          },
          { relativeToDirectory: true },
        );
      }
    }
  }, [router, transcript, queryResult.isSuccess, queryResult.data, resetMutation]);

  const handlePronounce = () => {
    player.replace(transcript!.audio);
    player.seekTo(0);
    player.play();
  };

  const handleStartRecording = async () => {
    player.replace("");
    {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
    }
  };

  const handleStopRecording = async () => {
    const duration = recorderState.durationMillis;
    {
      await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    }
    if (recorder.uri && duration >= RECORDING_DURATION_THRESHOLD) {
      const audio = await getLocalFileBase64(recorder.uri);
      mutation.mutate(audio, { onError: (error) => Alert.alert(error.message) });
    }
  };

  const frontCardAnimatedStyle = useAnimatedStyle(() => {
    const spin = interpolate(Number(flipped.value), [0, 1], [0, 180]);
    const rotate = withTiming(`${spin}deg`, { duration: 500 });
    return { transform: [{ rotateY: rotate }], backfaceVisibility: "hidden" };
  });

  const backCardAnimatedStyle = useAnimatedStyle(() => {
    const spin = interpolate(Number(flipped.value), [0, 1], [180, 360]);
    const rotate = withTiming(`${spin}deg`, { duration: 500 });
    return { transform: [{ rotateY: rotate }], backfaceVisibility: "hidden" };
  });

  const card = [
    {
      text: transcript?.text,
      style: frontCardAnimatedStyle,
    },
    {
      text: transcript?.sequence.replaceAll("/", ""),
      style: backCardAnimatedStyle,
    },
  ];

  return (
    <View style={tw`flex-1 items-center justify-between p-4`}>
      {queryTranscripts.isFetching ? (
        <View style={tw`w-full flex-grow items-center justify-center gap-4`}>
          <Spinner size={48} />
        </View>
      ) : (
        queryTranscripts.isSuccess && (
          <>
            <View style={tw`rounded-xl border-2 border-zinc-500/50 p-2.5`}>
              <Text style={tw`text-lg font-medium leading-tight`}>{transcripts!.scenario}</Text>
            </View>
            <View style={tw`w-full flex-grow items-center justify-center`}>
              <View style={tw`relative items-center justify-center bg-blue-500`}>
                {card.map(({ text, style }, index) => (
                  <AnimatedPressable
                    key={index}
                    onPress={() => (flipped.value = !flipped.value)}
                    onLongPress={handlePronounce}
                    style={[
                      tw.style(
                        "absolute items-center justify-center rounded-3xl border-2 border-zinc-500/50",
                        "bg-zinc-100 p-8 dark:bg-zinc-950",
                      ),
                      style,
                    ]}
                    onLayout={({ nativeEvent }) => setHeight((height) => Math.max(height, nativeEvent.layout.height))}>
                    <Text
                      style={[
                        tw`text-center text-3xl font-medium leading-normal`,
                        { fontFamily: "" }, // use default font for transcript text
                      ]}>
                      {text}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
              <View style={[tw`mt-5 items-center justify-center`, { top: height / 2 }]}>
                <View style={tw`flex-row items-center gap-1`}>
                  <FlipHorizontalIcon size={14} color={tw.color("zinc-500")} />
                  <Text style={tw`text-sm font-medium text-zinc-500`}>
                    Tap to see {_flipped ? "text" : "IPA"} transcript
                  </Text>
                </View>
                <View style={tw`flex-row items-center gap-1`}>
                  <EarIcon size={14} color={tw.color("zinc-500")} />
                  <Text style={tw`text-sm font-medium text-zinc-500`}>Long Press to play reference pronunciation</Text>
                </View>
              </View>
            </View>
            <View style={tw`h-1/6 w-full items-center justify-center px-8`}>
              {queryResult.isLoading ? (
                <View style={tw`flex-row items-center gap-2`}>
                  <Spinner />
                  <Text style={tw`font-medium text-neutral-500`}>Analyzing your pronunciation...</Text>
                </View>
              ) : (
                mutation.isIdle && (
                  <>
                    {!recorderState.isRecording && (
                      <Text style={tw`absolute -top-2 text-sm font-medium`}>Hold to Speak</Text>
                    )}
                    <Pressable
                      style={({ pressed }) =>
                        tw.style(
                          "mx-auto rounded-full p-6",
                          pressed && "opacity-80",
                          recorderState.isRecording ? "bg-red-500" : "bg-green-500",
                        )
                      }
                      onLongPress={handleStartRecording}
                      onPressOut={handleStopRecording}>
                      {recorderState.isRecording ? (
                        <AudioLinesIcon color="white" size={32} />
                      ) : (
                        <MicIcon color="white" size={32} />
                      )}
                    </Pressable>
                  </>
                )
              )}
            </View>
          </>
        )
      )}
    </View>
  );
}
