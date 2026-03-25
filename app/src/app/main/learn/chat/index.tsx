import { useRef, useState, type Ref } from "react";
import { Alert, FlatList, Pressable, ScrollView, View } from "react-native";
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
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Color from "color";
import {
  AudioLinesIcon,
  ChevronDown,
  ChevronUp,
  CircleCheckBigIcon,
  CircleIcon,
  ListTodoIcon,
  MicIcon,
  XIcon,
} from "lucide-react-native";
import tw from "twrnc";

import {
  ChatSessionStatus,
  useChatSession,
  type ChatSession,
  type ConversationMessage,
  type Evaluation,
  type Turn,
} from "~/client/chat";
import { Spinner, Text } from "~/components";
import { useNavigationOptions } from "~/hooks";
import { getLocalFileBase64 } from "~/utils";

const RECORDING_DURATION_THRESHOLD = 1500; // ms

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

const Header = ({ session, onClose }: { session: ChatSession; onClose: () => void }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
            {session.status === ChatSessionStatus.LOADING
              ? "Loading..."
              : session.status === ChatSessionStatus.FINISHED
                ? "Chat Summary"
                : "Chat Session"}
          </Text>
        </View>
      </View>
      <View style={[tw`flex-row gap-1.5 px-2 pb-2 pt-1.5`, { backgroundColor: theme.colors.card }]}>
        {Array.from({ length: session.data?.limit ?? 1 }).map((_, index) => {
          const limit = session.data?.limit ?? 0;
          const quota = session.data?.quota ?? 0;
          const progress = limit - quota;
          let color = theme.colors.border;
          if (index <= progress) {
            if (session.status === ChatSessionStatus.FINISHED) {
              color = tw.color("green-500")!;
            } else if (session.status !== ChatSessionStatus.LOADING) {
              color = index < progress ? tw.color("green-500")! : tw.color("sky-500")!;
            }
          }
          return <View key={index} style={tw.style("h-1.5 flex-1 rounded-full", { backgroundColor: color })} />;
        })}
      </View>
    </>
  );
};

const getScoreColor = (x: number) => {
  if (x >= 0.75) return tw.color("green-500");
  if (x >= 0.5) return tw.color("yellow-500");
  return tw.color("red-500");
};

const MessageListItem = ({
  message,
  turn,
  selected,
  onPress,
}: {
  message: ConversationMessage;
  turn?: Turn;
  selected: boolean;
  onPress: () => void;
}) => {
  const score = turn
    ? turn.pronunciation.score * 0.4 +
      turn.evaluation.criteria.accuracy * 0.2 +
      turn.evaluation.criteria.appropriacy * 0.3 +
      turn.evaluation.criteria.vocabulary * 0.1
    : undefined;
  return (
    <View style={tw.style("flex-row items-center gap-2.5", message.role === "user" ? "justify-end" : "justify-start")}>
      {score !== undefined && (
        <View style={tw`items-center`}>
          <Text style={[tw`text-sm font-medium`, { color: getScoreColor(score) }]}>{Math.round(score * 100)}%</Text>
          <Text style={tw`text-xs leading-none text-neutral-500`}>overall</Text>
        </View>
      )}
      <Pressable
        onPress={onPress}
        style={tw.style(
          "flex-shrink rounded-xl border-2 p-2.5",
          selected ? "border-zinc-500" : "border-transparent",
          message.role === "user" && "bg-green-500/50",
          message.role === "assistant" && "bg-neutral-300/50 dark:bg-neutral-700/50",
        )}>
        <Text style={tw`text-base`}>{message.role === "assistant" ? message.content : message.transcript.text}</Text>
      </Pressable>
    </View>
  );
};

const TurnSheet = ({
  ref,
  turn,
  onWillDismiss,
}: {
  ref?: React.Ref<TrueSheet>;
  turn: Turn;
  onWillDismiss: () => void;
}) => {
  const theme = useTheme();

  const [selection, setSelection] = useState<number | null>(null);

  return (
    <TrueSheet
      ref={ref}
      detents={["auto"]}
      maxHeight={500}
      initialDetentIndex={0}
      initialDetentAnimated={true}
      onWillDismiss={onWillDismiss}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`gap-8 p-4`}>
        <View style={tw`mt-8`}>
          <Text
            style={[
              tw`text-center text-5xl font-bold tracking-tighter`,
              { color: getScoreColor(turn.pronunciation.score) },
            ]}>
            {Math.round(turn.pronunciation.score * 100)}%
          </Text>
          <Text style={tw`text-center text-xl font-medium`}>Pronunciation</Text>
        </View>
        <View style={tw`mb-4 flex-row justify-around`}>
          {[
            { label: "Accuracy", value: turn.evaluation.criteria.accuracy },
            { label: "Appropriacy", value: turn.evaluation.criteria.appropriacy },
            { label: "Vocabulary", value: turn.evaluation.criteria.vocabulary },
          ].map(({ label, value }) => (
            <View key={label} style={tw`flex-shrink`}>
              <Text style={[tw`text-center text-3xl font-bold tracking-tighter`, { color: getScoreColor(value) }]}>
                {Math.round(value * 100)}%
              </Text>
              <Text style={tw`text-center text-base font-medium`}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={[tw`rounded-lg p-4`, { backgroundColor: theme.colors.background }]}>
          <Text style={tw`text-base`}>{turn.evaluation.explanation}</Text>
        </View>
        <View style={tw`gap-2.5`}>
          {turn.pronunciation.words.map(([word, { score, phonemes, alignments, differences }], index) => {
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
                    <Text style={[tw`text-lg`, { color: getScoreColor(score) }]}>{Math.round(score * 100)}%</Text>
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
                          const color = Color(getScoreColor(score * 100)).alpha(0.5);
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
        </View>
      </ScrollView>
    </TrueSheet>
  );
};

const TasksSheet = ({ ref, tasks }: { ref: Ref<TrueSheet>; tasks: Evaluation["tasks"] }) => {
  const theme = useTheme();

  return (
    <TrueSheet ref={ref} detents={["auto"]} style={tw`gap-4 px-4 py-6`}>
      <Text
        style={tw`text-center text-xl font-medium`}>{`Tasks Completed — ${tasks.filter((task) => task.completed).length}/${tasks.length}`}</Text>
      <View style={tw`gap-2.5`}>
        {tasks.map((task, index) => (
          <View
            key={index}
            style={[
              tw`flex-row items-center gap-2.5 rounded-2xl border border-zinc-500/50 px-4 py-2`,
              { backgroundColor: theme.colors.background },
            ]}>
            {task.completed ? (
              <CircleCheckBigIcon size={18} color={tw.color("green-500")} />
            ) : (
              <CircleIcon size={18} color={tw.color("neutral-500")} />
            )}
            <Text style={tw`shrink text-lg`}>{task.task}</Text>
          </View>
        ))}
      </View>
    </TrueSheet>
  );
};

export default function MainLearnChatScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder);

  const ref = useRef<FlatList<ConversationMessage>>(null);
  const sheetTasks = useRef<TrueSheet>(null);
  const sheetTurn = useRef<TrueSheet>(null);

  const [selection, setSelection] = useState<Turn | null>(null);

  const { session, turn, abort, end } = useChatSession({
    onClose: () => {
      if (router.canDismiss()) router.dismissAll();
    },
  });

  const handleClose = () => {
    if (session.status === ChatSessionStatus.FINISHED) return end();
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
    header: () => <Header session={session} onClose={handleClose} />,
  });

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (recorder.uri && duration >= RECORDING_DURATION_THRESHOLD) {
      const audio = await getLocalFileBase64(recorder.uri);
      const result = await turn(audio);
      if (result === null) Alert.alert("Speak Up!", "We couldn't hear you. Try to speak louder and clearer.");
    }
  };

  if (session.status === ChatSessionStatus.FINISHED) return <></>;

  return (
    <View style={[tw`flex-1 items-center justify-between py-4`, { paddingBottom: insets.bottom }]}>
      {session.status === ChatSessionStatus.LOADING ? (
        <View style={tw`w-4/6 flex-grow items-center justify-center gap-8`}>
          <Spinner size={48} />
          <Text style={tw`text-center text-base font-medium leading-tight text-neutral-500`}>
            Please ensure you are in a quiet environment for the best experience.
          </Text>
        </View>
      ) : (
        <>
          <View style={tw`mx-4 mb-2 rounded-xl border-2 border-zinc-500/50 p-2.5`}>
            <Text style={tw`text-lg font-medium leading-tight`}>{session.data.scenario.scenario}</Text>
          </View>
          <FlatList
            ref={ref}
            inverted={true}
            alwaysBounceVertical={false}
            data={[...session.data.conversation.messages].reverse()}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item, index: i }) => {
              const index = session.data.conversation.messages.length - 1 - i;
              const turn = session.data.turns.find((t) => t.index === index);
              return (
                <MessageListItem
                  message={item}
                  turn={turn}
                  selected={turn ? turn.index === selection?.index : false}
                  onPress={() => (turn ? setSelection(turn) : undefined)}
                />
              );
            }}
            style={tw`w-full flex-1`}
            contentContainerStyle={tw`flex-grow justify-end gap-2 p-4`}
          />
          <View style={tw`h-1/7 w-full items-center justify-center px-8`}>
            <View style={tw`w-full flex-row items-center justify-between`}>
              <Pressable
                onPress={() => sheetTasks.current?.present()}
                style={({ pressed }) =>
                  tw.style(
                    "flex-row items-center gap-1.5 rounded-full bg-zinc-300/50 px-4 py-2 dark:bg-zinc-700/50",
                    pressed && "opacity-80",
                  )
                }>
                <ListTodoIcon color={theme.colors.text} size={22} />
                <Text style={tw`text-lg font-medium`}>Tasks</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) =>
                  tw.style(
                    "absolute left-1/2 -translate-x-1/2 rounded-full p-4",
                    pressed && "opacity-80",
                    session.status === ChatSessionStatus.READY_TURN
                      ? recorderState.isRecording
                        ? "bg-red-500"
                        : "bg-green-500"
                      : "bg-transparent",
                  )
                }
                onLongPress={handleStartRecording}
                onPressOut={handleStopRecording}
                disabled={session.status !== ChatSessionStatus.READY_TURN}>
                {session.status === ChatSessionStatus.READY_TURN ? (
                  recorderState.isRecording ? (
                    <AudioLinesIcon color="white" size={32} />
                  ) : (
                    <MicIcon color="white" size={32} />
                  )
                ) : (
                  <Spinner size={36} />
                )}
              </Pressable>
            </View>
            <Text
              style={tw.style(
                "absolute bottom-0 text-sm font-medium",
                session.status === ChatSessionStatus.PENDING_TURN && "text-neutral-500",
              )}>
              {session.status === ChatSessionStatus.PENDING_TURN
                ? "Processing your speech..."
                : !recorderState.isRecording
                  ? "Hold to Speak"
                  : ""}
            </Text>
          </View>
          <TasksSheet ref={sheetTasks} tasks={session.data.tasks} />
          {selection !== null && (
            <TurnSheet ref={sheetTurn} turn={selection} onWillDismiss={() => setSelection(null)} />
          )}
        </>
      )}
    </View>
  );
}
