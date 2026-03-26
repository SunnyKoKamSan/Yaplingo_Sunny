import { useCallback } from "react";
import {
  AudioQuality,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from "expo-audio";

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

export type UseAudio = ReturnType<typeof useAudio>;

const useAudio = () => {
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder);

  const startRecording = useCallback(async () => {
    player.replace("");
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [player, recorder]);

  const stopRecording = useCallback(async () => {
    const duration = recorderState.durationMillis;
    await recorder.stop();
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
    if (recorder.uri && duration >= RECORDING_DURATION_THRESHOLD) {
      return await getLocalFileBase64(recorder.uri);
    }
  }, [recorder, recorderState.durationMillis]);

  return {
    player,
    playerStatus,
    recorder,
    recorderState,
    startRecording,
    stopRecording,
  } as const;
};

export default useAudio;
