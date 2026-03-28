import axios from "axios";
import tw from "twrnc";

export const getLocalFileBase64 = async (uri: string): Promise<string> => {
  const { data } = await axios.get<ArrayBuffer>(uri, {
    responseType: "arraybuffer",
    responseEncoding: "binary",
  });
  const encodeArrayBufferBase64 = (buffer: ArrayBuffer): string => {
    return btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""));
  };
  return encodeArrayBufferBase64(data);
};

export const getScoreColor = (score: number): string => {
  if (score >= 0.75) return tw.color("green-500")!;
  if (score >= 0.5) return tw.color("yellow-500")!;
  return tw.color("red-500")!;
};

export const formatCompactNumber = (x: number): string => {
  if (x >= 10000 && x < 1000000) return (x / 1000).toFixed(1) + "K";
  if (x >= 1000000 && x < 1000000000) return (x / 1000000).toFixed(1) + "M";
  return x.toString();
};
