import { useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import Animated, {
  FadeIn,
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
import { useQueryClient } from "@tanstack/react-query";
import type { RecorderState } from "expo-audio";
import { useRouter } from "expo-router";
import { ArrowRightIcon, EarIcon, FlipHorizontalIcon, PlayIcon, RedoIcon, StarsIcon, XIcon } from "lucide-react-native";
import tw from "twrnc";

import { EchoSessionStatus, useEchoSession, type Attempt, type EchoSession } from "~/client/echo";
import { LoadingView, PronunciationBreakdown, RecordButton } from "~/components";
import { Spinner, Text } from "~/components/primitives";
import { useAudio, useNavigationOptions } from "~/hooks";
import { getScoreColor } from "~/utils";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const Header = ({
  session,
  recorderState,
  onProceed,
  onClose,
}: {
  session: EchoSession;
  recorderState: RecorderState;
  onProceed: () => void;
  onClose: () => void;
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const disableProceed = recorderState.isRecording || session.status === EchoSessionStatus.PENDING_ATTEMPT;

  return (
    <>
      <View
        style={[
          tw`flex-row items-center justify-between px-4 pb-2`,
          { paddingTop: insets.top, backgroundColor: theme.colors.card },
        ]}>
        <Pressable onPress={onClose} style={({ pressed }) => tw.style(pressed && "opacity-50")}>
          <XIcon color={tw.color("zinc-500")} size={26} strokeWidth={2.5} />
        </Pressable>
        <View style={[tw`absolute inset-x-0 items-center justify-center`, { top: insets.top }]}>
          <Text style={tw`text-2xl font-bold leading-[0]`}>
            {session.status === EchoSessionStatus.LOADING_NEW
              ? "Loading..."
              : session.status === EchoSessionStatus.COMPLETED
                ? "Echo Summary"
                : "Echo Session"}
          </Text>
        </View>
        {session.status === EchoSessionStatus.LOADING_NEXT && <Spinner size={26} />}
        {!(
          session.status === EchoSessionStatus.LOADING_NEW ||
          session.status === EchoSessionStatus.LOADING_NEXT ||
          session.status === EchoSessionStatus.COMPLETED ||
          session.data.completed
        ) && (
          <Pressable
            disabled={disableProceed}
            onPress={() => onProceed()}
            style={({ pressed }) => tw.style(pressed && "opacity-50", disableProceed && "opacity-30")}>
            {session.data.attempts[session.data.progress].length > 0 ? (
              <ArrowRightIcon color={tw.color("green-500")} size={26} strokeWidth={2.5} />
            ) : (
              <RedoIcon color={tw.color("red-500")} size={26} strokeWidth={2.5} />
            )}
          </Pressable>
        )}
      </View>
      <View style={[tw`flex-row gap-1.5 px-2 pb-2 pt-1.5`, { backgroundColor: theme.colors.card }]}>
        {Array.from({ length: session.data?.total ?? 1 }).map((_, index) => {
          let color = theme.colors.border;
          if (session.status !== EchoSessionStatus.LOADING_NEW) {
            if (session.status === EchoSessionStatus.COMPLETED) {
              color = session.data.attempts[index].length > 0 ? tw.color("green-500")! : tw.color("red-500")!;
            } else {
              if (index <= session.data.progress) {
                if (session.data.attempts[index].length > 0) color = tw.color("green-500")!;
                else color = index === session.data.progress ? tw.color("sky-500")! : tw.color("red-500")!;
              }
            }
          }
          return <View key={index} style={tw.style("h-1.5 flex-1 rounded-full", { backgroundColor: color })} />;
        })}
      </View>
    </>
  );
};

const AttemptSheet = ({
  ref,
  attempt,
  onWillDismiss,
}: {
  ref?: React.Ref<TrueSheet>;
  attempt: Attempt;
  onWillDismiss?: () => void;
}) => {
  const theme = useTheme();

  const score = useMemo(() => {
    const color = getScoreColor(attempt.pronunciation.score);
    const percentage = Math.round(attempt.pronunciation.score * 100);
    let message = "bruh";
    if (percentage >= 90) message = "tuff";
    else if (percentage >= 75) message = "bro slayed";
    else if (percentage >= 50) message = "that's mid";
    else if (percentage >= 25) message = "skill issue";
    return { percentage, color, message };
  }, [attempt]);

  return (
    <TrueSheet
      ref={ref}
      detents={[0.5]}
      initialDetentIndex={0}
      initialDetentAnimated={true}
      onWillDismiss={onWillDismiss}>
      <ScrollView contentContainerStyle={tw`gap-4 p-4`}>
        <View style={tw`mt-8 items-center justify-center gap-2`}>
          <Text style={[tw`text-center text-6xl font-bold tracking-tighter`, { color: score.color }]}>
            {score.percentage}%
          </Text>
          <Text style={[tw`text-center text-2xl font-medium`, { color: score.color }]}>{score.message}</Text>
        </View>
        <View style={[tw`rounded-2xl p-4`, { backgroundColor: theme.colors.background }]}>
          <Text style={tw`text-base`}>{attempt.feedback}</Text>
        </View>
        <PronunciationBreakdown pronunciation={attempt.pronunciation} />
      </ScrollView>
    </TrueSheet>
  );
};

const SummaryView = ({ session }: { session: Extract<EchoSession, { status: EchoSessionStatus.COMPLETED }> }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [selection, setSelection] = useState<number | null>(null);

  const attempt = useMemo(
    // let's just assume only one attempt per transcript for now
    () => (selection !== null ? session.data.attempts[selection][0] : null),
    [session, selection],
  );

  return (
    <>
      <View style={[tw`flex-1 gap-6 px-4 py-6`, { paddingBottom: insets.bottom }]}>
        <Text style={tw`my-8 text-center text-6xl font-bold tracking-tighter text-sky-500`}>
          {`+ ${session.data.summary.points} XP`}
        </Text>
        <View style={tw`rounded-xl border-2 border-zinc-500/50 p-3`}>
          <Text
            style={[
              tw`absolute -top-4 left-2.5 px-1.5 text-lg font-bold text-amber-500`,
              { backgroundColor: theme.colors.background },
            ]}>
            #{session.data.scenario.topic}
          </Text>
          <Text style={tw`text-lg font-medium leading-tight`}>{session.data.scenario.scenario}</Text>
        </View>
        <View style={tw`grow gap-2`}>
          <View style={tw`flex-row items-center justify-between gap-2`}>
            <Text
              style={tw`text-base font-medium uppercase text-neutral-500`}>{`${session.data.scenario.transcripts.length} Transcripts`}</Text>
            <Text style={tw`text-base font-medium uppercase text-neutral-500`}>
              {`${session.data.attempts.reduce((total, attempts) => total + attempts.length, 0)} Attempts`}
            </Text>
          </View>
          <ScrollView style={tw`grow rounded-xl border-2 border-zinc-500/50`} contentContainerStyle={tw`gap-2.5 p-3`}>
            {session.data.scenario.transcripts.map((transcript, index) => {
              const attempts = session.data.attempts[index];
              const attempt = attempts[0];
              const color = attempt ? getScoreColor(attempt.pronunciation.score) : undefined;
              return (
                <Pressable
                  key={index}
                  onPress={() => setSelection(index)}
                  style={tw.style(
                    "flex-row items-center justify-between gap-4 rounded-lg border-2 p-2.5",
                    selection === index ? "border-zinc-500" : "border-zinc-500/50",
                  )}>
                  <Text style={tw`text-xl font-bold text-sky-500`}>#{index + 1}</Text>
                  <Text style={tw`shrink text-left text-base`} numberOfLines={2}>
                    {transcript.text}
                  </Text>
                  {attempts.length > 0 ? (
                    <Text style={[tw`text-xl font-medium`, { color }]}>
                      {`${Math.round(attempt.pronunciation.score * 100)}%`}
                    </Text>
                  ) : (
                    <XIcon color={tw.color("red-500")} size={20} strokeWidth={2.5} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
      {attempt && <AttemptSheet attempt={attempt} onWillDismiss={() => setSelection(null)} />}
    </>
  );
};

export default function MainLearnEchoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();

  const sheet = useRef<TrueSheet>(null);

  const audio = useAudio();

  const { session, submit, proceed, abort, end } = useEchoSession({
    onClose: () => {
      if (router.canDismiss()) router.dismissAll();
      client.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  const attempt = useMemo(() => {
    if (!session.data || session.data.completed) return undefined;
    const attempts = session.data.attempts[session.data.progress];
    return attempts.length > 0 ? attempts[attempts.length - 1] : undefined;
  }, [session.data]);

  const transcript = useMemo(() => {
    if (!session.data || session.data.completed) return undefined;
    return session.data.scenario.transcripts[session.data.progress];
  }, [session.data]);

  const _flipped = useSharedValue(false);
  const [flipped, setFlipped] = useState(false);
  const [height, setHeight] = useState(0);

  const [playbacking, setPlaybacking] = useState(false);

  useAnimatedReaction(
    () => _flipped.value,
    (value) => runOnJS(setFlipped)(value),
  );

  const handleProceed = () => {
    const callback = () => {
      proceed();
      audio.player.replace("");
      _flipped.value = false;
    };
    if (attempt) {
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

  const handleClose = () => {
    if (session.status === EchoSessionStatus.COMPLETED) return end();
    Alert.alert("Abort Session", "Are you sure you want to abort this session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Abort",
        style: "destructive",
        onPress: () => abort(),
      },
    ]);
  };

  useNavigationOptions({
    header: () => (
      <Header session={session} recorderState={audio.recorderState} onProceed={handleProceed} onClose={handleClose} />
    ),
  });

  const handlePronounce = () => {
    setPlaybacking(false);
    audio.player.replace(transcript!.audio);
    audio.player.seekTo(0);
    audio.player.play();
  };

  const handlePlayback = () => {
    if (!attempt) return;
    setPlaybacking(true);
    audio.player.replace(attempt.audio);
    audio.player.seekTo(0);
    audio.player.play();
  };

  const handleSubmit = async (data: string) => {
    const result = await submit(data);
    if (result === null) Alert.alert("Speak Up!", "We couldn't hear you. Try to speak louder and clearer.");
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

  const attemptCard = useMemo(
    () =>
      attempt
        ? [
            attempt.pronunciation.words.map(([word, { alignments }], key) => {
              const score = alignments.reduce((a, b) => a + b.score, 0) / alignments.length;
              const color = getScoreColor(score);
              return (
                <Text key={key} style={{ color, fontFamily: "" }}>
                  {`${word} `}
                </Text>
              );
            }),
            attempt.pronunciation.words.map(([, { alignments }]) =>
              alignments.map(({ score, token }, key) => (
                <Text key={key} style={{ color: getScoreColor(score), fontFamily: "" }}>
                  {token}
                  {key + 1 === alignments.length ? " " : null}
                </Text>
              )),
            ),
          ]
        : undefined,
    [attempt],
  );

  if (session.status === EchoSessionStatus.COMPLETED)
    return (
      <Animated.View entering={FadeIn.duration(200)} style={tw`flex-1`}>
        <SummaryView session={session} />
      </Animated.View>
    );

  return (
    <View style={[tw`flex-1 items-center justify-between gap-4 p-4`, { paddingBottom: insets.bottom }]}>
      {session.status === EchoSessionStatus.LOADING_NEW ? (
        <LoadingView />
      ) : (
        <>
          <View style={tw`rounded-xl border-2 border-zinc-500/50 p-3`}>
            <Text
              style={[
                tw`absolute -top-4 left-2.5 px-1.5 text-lg font-bold text-amber-500`,
                { backgroundColor: theme.colors.background },
              ]}>
              #{session.data.scenario.topic}
            </Text>
            <Text style={tw`text-lg font-medium leading-tight`}>{session.data.scenario.scenario}</Text>
          </View>
          {session.status !== EchoSessionStatus.LOADING_NEXT && (
            <>
              <View style={tw`w-full grow items-center justify-center`}>
                <Animated.View
                  entering={SlideInRight}
                  exiting={SlideOutLeft}
                  style={tw`relative items-center justify-center`}>
                  {(attemptCard ?? transcriptCard ?? []).map((c, index) => (
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
                {session.status === EchoSessionStatus.READY_ATTEMPT && (
                  <View style={[tw`mt-5 items-center justify-center`, { top: height / 2 }]}>
                    <View style={tw`flex-row items-center gap-1`}>
                      <FlipHorizontalIcon size={14} color={tw.color("neutral-500")} />
                      <Text style={tw`text-sm font-medium text-neutral-500`}>
                        Tap to see {flipped ? "text" : "IPA"} transcript
                      </Text>
                    </View>
                    <View style={tw`flex-row items-center gap-1`}>
                      <EarIcon size={14} color={tw.color("neutral-500")} />
                      <Text style={tw`text-sm font-medium text-neutral-500`}>
                        Long Press to play reference pronunciation
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              <View style={tw`h-1/7 w-full items-center justify-center px-4`}>
                {attempt ? (
                  <>
                    <Pressable
                      onPress={() => sheet.current?.present()}
                      style={({ pressed }) =>
                        tw.style(
                          "absolute -top-12 flex-row items-center gap-1.5 rounded-full border-2 border-transparent bg-zinc-200 px-2.5 py-1.5 dark:bg-zinc-800",
                          pressed && "border-zinc-500/50",
                        )
                      }>
                      <StarsIcon color={theme.colors.text} size={20} />
                      <Text style={tw`text-base font-medium`}>Result</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) =>
                        tw.style(
                          "mx-auto rounded-full bg-sky-500 p-4",
                          pressed && "opacity-80",
                          audio.playerStatus.playing && playbacking && "opacity-50",
                        )
                      }
                      disabled={audio.playerStatus.playing && playbacking}
                      onPress={handlePlayback}>
                      <PlayIcon color="white" fill="white" size={32} />
                    </Pressable>
                    {!(audio.playerStatus.playing && playbacking) && (
                      <Text style={tw`absolute bottom-0 text-sm font-medium`}>Playback Your Speech</Text>
                    )}
                  </>
                ) : (
                  <RecordButton
                    audio={audio}
                    isPending={session.status === EchoSessionStatus.PENDING_ATTEMPT}
                    pendingText="Analyzing your pronunciation..."
                    onSubmit={handleSubmit}
                  />
                )}
              </View>
            </>
          )}
        </>
      )}
      {attempt && <AttemptSheet ref={sheet} attempt={attempt} />}
    </View>
  );
}
