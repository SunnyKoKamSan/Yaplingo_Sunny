import { useReducer } from "react";

const useFormReducer = <T>(init: T) =>
  useReducer<T, [{ field: keyof T; value: T[keyof T] }]>((state, action) => {
    if (action === null) return init;
    const { field, value } = action;
    return { ...state, [field]: value };
  }, init);

export default useFormReducer;
