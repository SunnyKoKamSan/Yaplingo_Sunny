import React, { useEffect } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import {
  AudioModule,
  AudioQuality,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import axios from "axios";
import tw from "twrnc";

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

export default function HomeScreen() {
  const recorder = useAudioRecorder({
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
  });
  const recorderState = useAudioRecorderState(recorder);

  const mutation = useMutation({
    mutationFn: async (uri: string) => {
      const data = new FormData();
      // @ts-expect-error React Native FormData issue
      data.append("audio", { uri, name: "audio.wav", type: "audio/vnd.wav" });
      const response = await axios.post(`${API_URL}/teach/1`, data, {
        validateStatus: () => true, // do not throw as error on non-ok status
      });
      if (response.status !== 200) {
        throw new Error(response.data as string);
      }
      return response.data as Result;
    },
  });

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return Alert.alert("Permission Denied");
    })();
  }, []);

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
    if (recorder.uri) {
      mutation.mutate(recorder.uri);
    }
  }

  return (
    <View style={tw`flex-1 items-center justify-center gap-2`}>
      <Pressable
        style={({ pressed }) =>
          tw.style("rounded-lg px-5 py-3", pressed && "opacity-50", {
            backgroundColor: recorderState.isRecording ? "red" : "cyan",
          })
        }
        onPress={() => (recorderState.isRecording ? stopRecording() : startRecording())}>
        {recorderState.isRecording ? <Text>Stop</Text> : <Text>Start</Text>}
      </Pressable>
      {mutation.isSuccess && <Text>{mutation.data?.feedback ?? "SILENCE"}</Text>}
      {mutation.isError && <Text style={tw`text-red-500`}>{mutation.error.message}</Text>}
    </View>
  );
}
