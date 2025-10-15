import React from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import axios from "axios";
import { AudioLinesIcon, MicIcon, Repeat2Icon, Volume2Icon } from "lucide-react-native";
import tw from "twrnc";

import { encodeArrayBufferBase64 } from "~/utils";

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

type Transcript = {
  id: string;
  text: string;
  phonemes: string[];
};

type Result = {
  feedback: string;
  phonemes: {
    aligned: {
      token: string;
      score: number;
      interval: [number, number];
    }[];
    predicted: string[];
  };
} | null;

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const client = axios.create({
  baseURL: API_URL,
  responseType: "json",
});

export default function HomeScreen() {
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder);

  const _queryTranscript = useQuery({
    queryKey: ["transcript"],
    queryFn: async () => {
      const response = await client.get<Transcript>("/");
      return response.data;
    },
  });
  const { data: transcript, ...queryTranscript } = _queryTranscript;

  const _queryPronunciation = useQuery({
    queryKey: ["pronunciation", transcript?.id],
    queryFn: async () => {
      const response = await client.get<ArrayBuffer>(`/${transcript!.id}/pronunciation.wav`, {
        responseType: "arraybuffer",
      });
      return response.data;
    },
    enabled: !!transcript,
  });
  const { data: pronunciation, ...queryPronunciation } = _queryPronunciation;

  const mutation = useMutation({
    mutationFn: async (uri: string) => {
      if (!transcript) throw new Error("No transcript loaded.");
      const data = new FormData();
      // @ts-expect-error React Native FormData issue
      data.append("audio", { uri, name: "audio.wav", type: "audio/vnd.wav" });
      const response = await client.post(`/${transcript.id}/teach`, data, {
        validateStatus: () => true, // do not throw as error on non-ok status
      });
      if (response.status !== 200) {
        throw new Error(response.data as string);
      }
      return response.data as Result;
    },
  });

  React.useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return Alert.alert("Permission Denied");
    })();
  }, []);

  React.useEffect(() => {
    // replace player's audio source when `pronunciation` changes
    if (pronunciation) {
      const base64 = encodeArrayBufferBase64(pronunciation);
      const uri = `data:audio/wav;base64,${base64}`;
      player.replace(uri);
    }
  }, [player, pronunciation]);

  async function startRecording() {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    await recorder.prepareToRecordAsync();
    recorder.record();
    mutation.reset();
  }

  async function stopRecording() {
    await recorder.stop();
    if (recorder.uri) mutation.mutate(recorder.uri);
  }

  const disabledPronounce =
    playerStatus.playing ||
    playerStatus.isBuffering ||
    queryTranscript.isFetching ||
    queryTranscript.isError ||
    queryPronunciation.isFetching ||
    queryPronunciation.isError;
  const disabledRecord =
    mutation.isPending || queryTranscript.isFetching || queryTranscript.isError;
  const disabledNext = mutation.isPending || queryTranscript.isFetching;

  return (
    <SafeAreaView style={tw`flex-1 items-center justify-between gap-2 px-4`}>
      <View style={tw`w-full flex-row items-center justify-center p-2`}>
        <Text style={[tw`text-2xl text-green-500`, { fontFamily: "Feather-Bold" }]}>yaplingo</Text>
        {/* <Text style={tw`text-lg font-medium`}>{new Date().toLocaleDateString()}</Text> */}
      </View>
      <View style={tw`gap-4`}>
        {queryTranscript.isFetching ? (
          <ActivityIndicator size="large" />
        ) : queryTranscript.isSuccess ? (
          <View style={tw`items-center justify-center gap-4 rounded-xl bg-white p-8 `}>
            <Text selectable style={tw`text-center text-3xl font-medium`}>
              {transcript!.text}
            </Text>
            <Text style={tw`text-center text-2xl font-medium`}>
              {transcript!.phonemes.join(" ")}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={tw`w-full flex-row items-center justify-between p-8`}>
        {!recorderState.isRecording && (
          <Pressable
            style={({ pressed }) =>
              tw.style("rounded-full bg-violet-500 p-4", pressed && "opacity-80")
            }
            onPress={() => {
              player.seekTo(0);
              player.play();
            }}
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
          onPress={() => (recorderState.isRecording ? stopRecording() : startRecording())}
          disabled={disabledRecord}>
          {recorderState.isRecording ? (
            <AudioLinesIcon color="white" size={32} />
          ) : (
            <MicIcon color="white" size={32} />
          )}
        </Pressable>
        {!recorderState.isRecording && (
          <Pressable
            style={({ pressed }) =>
              tw.style("rounded-full bg-gray-500 p-4", pressed && "opacity-80")
            }
            onPress={() => {
              player.pause();
              queryTranscript.refetch();
            }}
            disabled={disabledNext}>
            <Repeat2Icon color="white" size={24} />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
