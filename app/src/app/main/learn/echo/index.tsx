import React from "react";
import { Alert, Pressable, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import {
  AudioModule,
  AudioQuality,
  RecordingOptions,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useRouter } from "expo-router";
import { AudioLinesIcon, MicIcon, Repeat2Icon, Volume2Icon } from "lucide-react-native";
import tw from "twrnc";

import { useTeachMutation, useTranscriptQuery } from "~/client";
import { Spinner, Text } from "~/components";
import { getLocalFileBase64 } from "~/utils";

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

export default function MainLearnIndexScreen() {
  const router = useRouter();
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder);

  const { data: transcript, ...query } = useTranscriptQuery();
  const mutation = useTeachMutation(transcript);

  const flipped = useSharedValue(false);

  React.useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return Alert.alert("Permission Denied");
    })();
  }, []);

  React.useEffect(() => {
    if (playerStatus.isLoaded) {
      player.seekTo(0);
      player.play();
    }
  }, [player, playerStatus.isLoaded]);

  const handleStartRecording = async () => {
    mutation.reset();
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
    {
      await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    }
    if (recorder.uri) {
      const audio = await getLocalFileBase64(recorder.uri);
      mutation.mutate(audio, {
        onSuccess: (data) => {
          if (!data) return player.replace("");
          player.replace(data.feedback.audio);
          router.navigate("./feedback", { relativeToDirectory: true });
        },
        onError: (error) => Alert.alert(error.message),
      });
    }
  };

  const handlePronounce = async () => {
    player.replace(transcript!.audio);
  };

  const handleNext = () => {
    player.replace("");
    mutation.reset();
    query.refetch();
    flipped.value = false;
  };

  const disabledPronounce = playerStatus.playing || query.isFetching || query.isError;
  const disabledRecord = mutation.isPending || query.isFetching || query.isError;
  const disabledNext = mutation.isPending || query.isFetching;

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
    <View style={tw`flex-1 items-center px-4 py-8`}>
      <View style={tw`flex-grow items-center justify-center`}>
        {query.isFetching ? (
          <Spinner size={48} />
        ) : (
          query.isSuccess &&
          card.map(({ text, style }, index) => (
            <Animated.ScrollView
              key={index}
              alwaysBounceVertical={false}
              showsVerticalScrollIndicator={false}
              style={[
                tw.style(
                  "max-h-5/6 absolute flex-grow-0 rounded-3xl border-2 border-zinc-500/50 shadow-md",
                  "bg-zinc-100 dark:bg-zinc-950",
                ),
                style,
              ]}
              contentContainerStyle={tw`items-center justify-center`}>
              <Pressable onPress={() => (flipped.value = !flipped.value)} style={tw`size-full p-8`}>
                <Text
                  style={[
                    tw`text-center text-3xl font-medium leading-normal`,
                    { fontFamily: "" }, // use default font for transcript text
                  ]}>
                  {text}
                </Text>
              </Pressable>
            </Animated.ScrollView>
          ))
        )}
      </View>
      <View style={tw`h-1/6 w-full flex-row items-center justify-center gap-2 px-8`}>
        {mutation.isPending ? (
          <>
            <Spinner />
            <Text style={tw`font-medium text-neutral-500`}>Analyzing your pronunciation...</Text>
          </>
        ) : (
          <>
            {!recorderState.isRecording && (
              <Pressable
                style={({ pressed }) => tw.style("rounded-full bg-violet-500 p-4", pressed && "opacity-80")}
                onPress={handlePronounce}
                disabled={disabledPronounce}>
                <Volume2Icon color="white" size={24} />
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) =>
                tw.style(
                  "mx-auto rounded-full p-6",
                  pressed && "opacity-80",
                  recorderState.isRecording ? "bg-rose-500" : "bg-sky-500",
                )
              }
              onPress={recorderState.isRecording ? handleStopRecording : handleStartRecording}
              disabled={disabledRecord}>
              {recorderState.isRecording ? (
                <AudioLinesIcon color="white" size={32} />
              ) : (
                <MicIcon color="white" size={32} />
              )}
            </Pressable>
            {!recorderState.isRecording && (
              <Pressable
                style={({ pressed }) => tw.style("rounded-full bg-emerald-500 p-4", pressed && "opacity-80")}
                onPress={handleNext}
                disabled={disabledNext}>
                <Repeat2Icon color="white" size={24} />
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}
