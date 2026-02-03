import { useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  SlideInRight,
  SlideOutLeft,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
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
import Color from "color";
import {
  ArrowRightIcon,
  AudioLinesIcon,
  CheckIcon,
  ChevronDown,
  ChevronUp,
  EarIcon,
  FlipHorizontalIcon,
  MicIcon,
  RedoIcon,
  XIcon,
} from "lucide-react-native";
import tw from "twrnc";

import { EchoSessionStatus, Result, useEchoSession, type EchoSession } from "~/client/echo";
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
  web: {},
};

const Header = ({
  status,
  session,
  isRecording,
  onProceed,
  onAbort,
}: {
  status: EchoSessionStatus;
  session: EchoSession | undefined;
  isRecording: boolean;
  onProceed: () => void;
  onAbort: () => void;
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const disableProceed =
    isRecording ||
    status === EchoSessionStatus.LOADING_NEW ||
    status === EchoSessionStatus.LOADING_NEXT ||
    status === EchoSessionStatus.PENDING_RESULT;

  return (
    <>
      <View
        style={[
          tw`flex-row items-center justify-between px-4 pb-2`,
          { paddingTop: insets.top, backgroundColor: theme.colors.card },
        ]}>
        <Pressable onPress={onAbort} style={({ pressed }) => tw.style(pressed && "opacity-50")}>
          <XIcon color={tw.color("neutral-500")} size={26} strokeWidth={2.5} />
        </Pressable>
        <View style={[tw`absolute inset-x-0 items-center justify-center`, { top: insets.top }]}>
          {status === EchoSessionStatus.LOADING_NEW ? (
            <Text style={tw`text-2xl font-bold leading-[0]`}>Loading...</Text>
          ) : (
            <Text style={tw`text-2xl font-bold leading-[0]`}>
              Echoing on {<Text style={tw`font-bold text-amber-500`}>#{session!.topic}</Text>}
            </Text>
          )}
        </View>
        {!disableProceed && (
          <Pressable onPress={() => onProceed()} style={({ pressed }) => tw.style(pressed && "opacity-50")}>
            {session!.result ? (
              session!.progress + 1 === session!.total ? (
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
        {Array.from({ length: 5 }).map((_, index) => {
          let color = theme.colors.border;
          if (status !== EchoSessionStatus.LOADING_NEW && index <= session!.progress) {
            if (session!.attempts[index] > 0) color = tw.color("green-500")!;
            else color = index === session!.progress ? tw.color("sky-500")! : tw.color("red-500")!;
          }
          return <View key={index} style={tw.style("h-1.5 flex-1 rounded-full", { backgroundColor: color })} />;
        })}
      </View>
    </>
  );
};

const getScoringPercentage = (scores: { score: number }[]) => {
  const total = scores.reduce((a, b) => a + b.score, 0);
  return Math.round((total / scores.length) * 100);
};

const getScoringColor = (x: number) => {
  if (x >= 75) return tw.color("green-500");
  if (x >= 50) return tw.color("yellow-500");
  return tw.color("red-500");
};

const ResultSheet = ({ result }: { result: Result }) => {
  const theme = useTheme();

  const sheet = useRef<TrueSheet>(null);

  const [selection, setSelection] = useState<number | null>(null);

  return (
    <TrueSheet ref={sheet} detents={[0.5]} initialDetentIndex={0} initialDetentAnimated={true} cornerRadius={16}>
      <ScrollView contentContainerStyle={tw`gap-2.5 p-4`}>
        <View style={[tw`mb-2 rounded-lg p-4`, { backgroundColor: theme.colors.background }]}>
          <Text style={tw`text-base`}>{result.feedback}</Text>
        </View>
        {result.pronunciation.words.map(([word, { phonemes, alignments, differences }], index) => {
          const percentage = getScoringPercentage(alignments);
          const color = getScoringColor(percentage);
          return (
            <Pressable
              key={index}
              onPress={() => setSelection(selection === index ? null : index)}
              style={tw.style(
                "gap-2 rounded-lg border px-4 py-2",
                selection === index ? "border-zinc-500" : "border-zinc-500/50",
                { backgroundColor: theme.colors.background },
              )}>
              <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-row items-center gap-4`}>
                  <Text style={tw`text-lg font-bold`}>{word}</Text>
                  <Text style={[tw`text-lg`, { color }]}>{percentage}%</Text>
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
                      {alignments.map(({ token, score }, key) => {
                        const color = Color(getScoringColor(score * 100)).alpha(0.5);
                        return (
                          <View key={key} style={[tw`rounded px-1 py-0.5`, { backgroundColor: color.toString() }]}>
                            <Text style={[tw`text-base`, { fontFamily: "" }]}>{token}</Text>
                          </View>
                        );
                      })}
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
      </ScrollView>
    </TrueSheet>
  );
};

export default function MainLearnEchoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder);

  const { status, session, submit, proceed, abort } = useEchoSession({
    onClose: () => {
      if (router.canDismiss()) {
        router.dismissAll();
      }
    },
  });
  const { transcript, result } = session ?? {};

  const _flipped = useSharedValue(false);
  const [flipped, setFlipped] = useState(false);
  const [height, setHeight] = useState(0);

  useAnimatedReaction(
    () => _flipped.value,
    (value) => runOnJS(setFlipped)(value),
  );

  const handleProceed = () => {
    if (status === EchoSessionStatus.LOADING_NEW) {
      throw new Error("cannot proceed while loading new session");
    }

    const callback = () => {
      proceed();
      if (session.progress < session.total - 1) {
        player.replace("");
        _flipped.value = false;
      } else {
        router.dismiss();
      }
    };

    if (session.result) {
      callback();
    } else {
      Alert.alert("Skip Attempt", "Are you sure you want to skip this attempt?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: callback,
        },
      ]);
    }
  };

  const handleAbort = () => {
    Alert.alert("Abort Session", "Are you sure you want to abort this session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Abort",
        style: "destructive",
        onPress: () => {
          abort();
          router.dismiss();
        },
      },
    ]);
  };

  useNavigationOptions({
    header: () => (
      <Header
        status={status}
        session={session}
        isRecording={recorderState.isRecording}
        onProceed={handleProceed}
        onAbort={handleAbort}
      />
    ),
  });

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
      const result = await submit(audio);
      if (result === null) Alert.alert("Speak Up!", "We couldn't hear you. Try to speak louder and clearer.");
      else session!.attempts[session!.progress] += 1;
    }
  };

  const frontCardAnimatedStyle = useAnimatedStyle(() => {
    const spin = interpolate(Number(_flipped.value), [0, 1], [0, 180]);
    const rotate = withTiming(`${spin}deg`, { duration: 500 });
    return { transform: [{ rotateY: rotate }], backfaceVisibility: "hidden" };
  });

  const backCardAnimatedStyle = useAnimatedStyle(() => {
    const spin = interpolate(Number(_flipped.value), [0, 1], [180, 360]);
    const rotate = withTiming(`${spin}deg`, { duration: 500 });
    return { transform: [{ rotateY: rotate }], backfaceVisibility: "hidden" };
  });

  const transcriptCard = useMemo(
    () => (transcript ? [transcript.text, transcript.sequence.replaceAll("/", "")] : undefined),
    [transcript],
  );

  const resultCard = useMemo(
    () =>
      result
        ? [
            result.pronunciation.words.map(([word, { alignments }], key) => {
              const score = alignments.reduce((a, b) => a + b.score, 0) / alignments.length;
              const color = getScoringColor(score * 100);
              return (
                <Text key={key} style={{ color, fontFamily: "" }}>
                  {`${word} `}
                </Text>
              );
            }),
            result.pronunciation.words.map(([, { alignments }]) =>
              alignments.map(({ score, token }, key) => (
                <Text key={key} style={{ color: getScoringColor(score * 100), fontFamily: "" }}>
                  {token}
                  {key + 1 === alignments.length ? " " : null}
                </Text>
              )),
            ),
          ]
        : undefined,
    [result],
  );

  const score = useMemo(() => {
    if (!result) return undefined;
    const percentage = getScoringPercentage(result.pronunciation.alignments);
    const color = getScoringColor(percentage);
    let message = "bruh";
    if (percentage >= 90) message = "tuff";
    else if (percentage >= 75) message = "bro slayed";
    else if (percentage >= 50) message = "that's mid";
    else if (percentage >= 25) message = "skill issue";
    return { percentage, color, message };
  }, [result]);

  return (
    <View style={[tw`flex-1 items-center justify-between gap-4 p-4`, { paddingBottom: insets.bottom }]}>
      {status === EchoSessionStatus.LOADING_NEW ? (
        <View style={tw`w-4/6 flex-grow items-center justify-center gap-8`}>
          <Spinner size={48} />
          <Text style={tw`text-center text-base font-medium leading-tight text-zinc-500`}>
            Please ensure you are in a quiet environment for the best experience.
          </Text>
        </View>
      ) : (
        <>
          <View style={tw`rounded-xl border-2 border-zinc-500/50 p-2.5`}>
            <Text style={tw`text-lg font-medium leading-tight`}>{session.scenario}</Text>
          </View>
          <View style={tw`w-full flex-grow items-center justify-center`}>
            {result && (
              <View style={tw`absolute top-4 items-center justify-center gap-2`}>
                <Text style={[tw`text-center text-5xl font-bold tracking-tighter`, { color: score!.color }]}>
                  {score!.percentage}%
                </Text>
                <Text style={[tw`text-center text-2xl font-medium`, { color: score!.color }]}>{score!.message}</Text>
              </View>
            )}
            <View style={tw`w-full`}>
              {status !== EchoSessionStatus.LOADING_NEXT && (
                <Animated.View
                  entering={SlideInRight}
                  exiting={SlideOutLeft}
                  style={tw`relative items-center justify-center`}>
                  {(resultCard ?? transcriptCard ?? []).map((c, index) => (
                    <AnimatedPressable
                      key={index}
                      onPress={() => (_flipped.value = !_flipped.value)}
                      onLongPress={handlePronounce}
                      style={[
                        tw.style(
                          "absolute items-center justify-center rounded-3xl border-2 border-zinc-500/50",
                          "bg-zinc-100 p-8 dark:bg-zinc-950",
                        ),
                        index === 0 ? frontCardAnimatedStyle : backCardAnimatedStyle,
                      ]}
                      onLayout={({ nativeEvent }) =>
                        setHeight((height) => Math.max(height, nativeEvent.layout.height))
                      }>
                      <Text
                        style={[
                          tw`text-center text-3xl font-medium leading-normal`,
                          { fontFamily: "" }, // use default font for transcript text
                        ]}>
                        {c}
                      </Text>
                    </AnimatedPressable>
                  ))}
                </Animated.View>
              )}
              {status === EchoSessionStatus.PENDING_ATTEMPT && (
                <View style={[tw`mt-5 items-center justify-center`, { top: height / 2 }]}>
                  <View style={tw`flex-row items-center gap-1`}>
                    <FlipHorizontalIcon size={14} color={tw.color("zinc-500")} />
                    <Text style={tw`text-sm font-medium text-zinc-500`}>
                      Tap to see {flipped ? "text" : "IPA"} transcript
                    </Text>
                  </View>
                  <View style={tw`flex-row items-center gap-1`}>
                    <EarIcon size={14} color={tw.color("zinc-500")} />
                    <Text style={tw`text-sm font-medium text-zinc-500`}>
                      Long Press to play reference pronunciation
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
          <View style={tw`h-1/6 w-full items-center justify-center px-8`}>
            {status === EchoSessionStatus.PENDING_RESULT && (
              <View style={tw`flex-row items-center gap-2`}>
                <Spinner />
                <Text style={tw`font-medium text-neutral-500`}>Analyzing your pronunciation...</Text>
              </View>
            )}
            {status === EchoSessionStatus.PENDING_ATTEMPT && (
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
            )}
          </View>
        </>
      )}
      {result && <ResultSheet result={result} />}
    </View>
  );
}
