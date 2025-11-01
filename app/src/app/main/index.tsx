import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import * as Speech from "expo-speech";
import { AudioLinesIcon, MicIcon, Repeat2Icon, Volume2Icon } from "lucide-react-native";
import tw from "twrnc";

import { useTeachMutation, useTranscriptQuery, type Result } from "~/client";

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

export default function MainIndexScreen() {
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder);

  const { data: transcript, ...query } = useTranscriptQuery();

  const mutation = useTeachMutation(transcript);

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
    await Speech.stop();
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
    if (recorder.uri)
      mutation.mutate(recorder.uri, {
        onSuccess: (data) => {
          if (!data) return player.replace("");
          const base64 = data.feedback.audio;
          player.replace(`data:audio/wav;base64,${base64}`);
        },
        onError: (error) => Alert.alert(error.message),
      });
  };

  const handlePronounce = async () => {
    player.replace("");
    await Speech.stop();
    Speech.speak(transcript!.text);
  };

  const handleNext = () => {
    player.replace("");
    Speech.stop();
    mutation.reset();
    query.refetch();
  };

  const calculateScorePercentage = (result: Result) => {
    const scores = result.phonemes.alignments.map((a) => a.score);
    const total = scores.reduce((a, b) => a + b, 0);
    return Math.round((total / scores.length) * 100);
  };

  const disabledPronounce = playerStatus.playing || query.isFetching || query.isError;
  const disabledRecord = mutation.isPending || query.isFetching || query.isError;
  const disabledNext = mutation.isPending || query.isFetching;

  return (
    <SafeAreaView style={tw`flex-1 items-center justify-between gap-2 px-4`}>
      <View style={tw`flex-grow items-center justify-center gap-4`}>
        {query.isFetching ? (
          <ActivityIndicator size="large" />
        ) : (
          <>
            {mutation.isSuccess && mutation.data && (
              <Text style={tw`mb-4 text-center text-5xl font-bold`}>{calculateScorePercentage(mutation.data)}</Text>
            )}
            {query.isSuccess && (
              <View style={tw`items-center justify-center gap-4 rounded-xl bg-white p-8 `}>
                <Text selectable style={tw`text-center text-3xl font-medium`}>
                  {transcript!.text}
                </Text>
                <Text style={tw`text-center text-2xl font-medium`}>{transcript!.sequence}</Text>
              </View>
            )}
            {mutation.isSuccess && mutation.data && (
              <ScrollView style={tw`max-h-64 rounded-xl bg-white`} contentContainerStyle={tw`p-8`}>
                <Text style={tw`text-lg font-medium`}>{mutation.data.feedback.text}</Text>
              </ScrollView>
            )}
          </>
        )}
      </View>
      {mutation.isPending ? (
        <View style={tw`flex-row items-center justify-center gap-2 p-8`}>
          <ActivityIndicator size="small" />
          <Text style={tw`font-medium text-neutral-500`}>Analyzing your pronunciation...</Text>
        </View>
      ) : (
        <View style={tw`w-full flex-row items-center justify-between p-8`}>
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
                recorderState.isRecording ? "bg-red-500" : "bg-blue-500",
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
              style={({ pressed }) => tw.style("rounded-full bg-gray-500 p-4", pressed && "opacity-80")}
              onPress={handleNext}
              disabled={disabledNext}>
              <Repeat2Icon color="white" size={24} />
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
