import { useRef, type Ref } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
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
import { AudioLinesIcon, CircleCheckBigIcon, CircleIcon, ListTodoIcon, MicIcon, XIcon } from "lucide-react-native";
import tw from "twrnc";

import { ChatSessionStatus, useChatSession, type ChatSession } from "~/client/chat";
import type { ConversationMessage, Evaluation } from "~/client/chat/models";
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

const MessageListItem = ({ message }: { message: ConversationMessage }) => {
  return (
    <View style={tw.style("flex-row", message.role === "assistant" ? "justify-start" : "justify-end")}>
      <View
        style={tw.style(
          "rounded-xl px-4 py-2.5",
          message.role === "user" && "bg-green-500/50",
          message.role === "assistant" && "bg-neutral-300/50 dark:bg-neutral-700/50",
        )}>
        <Text style={tw`text-base`}>{message.role === "assistant" ? message.content : message.transcript.text}</Text>
      </View>
    </View>
  );
};

const TasksSheet = ({ ref, tasks }: { ref: Ref<TrueSheet>; tasks: Evaluation["tasks"] }) => {
  const theme = useTheme();

  return (
    <TrueSheet ref={ref} detents={["auto"]} cornerRadius={16} style={tw`gap-4 px-4 py-6`}>
      <Text style={tw`text-center text-xl font-medium`}>Your Tasks</Text>
      <View style={tw`gap-2.5`}>
        {tasks.map((task, index) => (
          <View
            key={index}
            style={[
              tw`flex-row items-center gap-2.5 rounded-xl border border-zinc-500/50 px-4 py-2`,
              { backgroundColor: theme.colors.background },
            ]}>
            {task.completed ? (
              <CircleCheckBigIcon size={18} color={tw.color("green-500")} />
            ) : (
              <CircleIcon size={18} color={tw.color("neutral-500")} />
            )}
            <Text style={tw`shrink text-base font-medium`}>{task.task}</Text>
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
  const sheet = useRef<TrueSheet>(null);

  const { session, submit, abort, end } = useChatSession({
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
      const result = await submit(audio);
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
            <Text style={tw`text-lg font-medium leading-tight`}>{session.data.scenario}</Text>
          </View>
          <FlatList
            ref={ref}
            inverted={true}
            alwaysBounceVertical={false}
            data={[...session.data.messages].reverse()}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => <MessageListItem message={item} />}
            contentContainerStyle={tw`flex-grow gap-2 p-4`}
          />
          <View style={tw`h-1/7 w-full items-center justify-center px-8`}>
            <View style={tw`w-full flex-row items-center justify-between`}>
              <Pressable
                onPress={() => sheet.current?.present()}
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
                    session.status === ChatSessionStatus.READY_ATTEMPT
                      ? recorderState.isRecording
                        ? "bg-red-500"
                        : "bg-green-500"
                      : "bg-transparent",
                  )
                }
                onLongPress={handleStartRecording}
                onPressOut={handleStopRecording}
                disabled={session.status !== ChatSessionStatus.READY_ATTEMPT}>
                {session.status === ChatSessionStatus.READY_ATTEMPT ? (
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
                session.status === ChatSessionStatus.PENDING_RESULT && "text-neutral-500",
              )}>
              {session.status === ChatSessionStatus.PENDING_RESULT
                ? "Processing your speech..."
                : !recorderState.isRecording
                  ? "Hold to Speak"
                  : ""}
            </Text>
          </View>
          <TasksSheet ref={sheet} tasks={session.data.tasks} />
        </>
      )}
    </View>
  );
}
