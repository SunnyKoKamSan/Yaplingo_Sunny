import axios from "axios";

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
