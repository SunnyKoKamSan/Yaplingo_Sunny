import React from "react";

export const encodeArrayBufferBase64 = (buffer: ArrayBuffer): string => {
  return btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""));
};

export const useFormReducer = <T>(init: T) =>
  React.useReducer<T, [{ field: keyof T; value: T[keyof T] }]>((state, action) => {
    if (action === null) return init;
    const { field, value } = action;
    return { ...state, [field]: value };
  }, init);
