import axios, { AxiosError } from "axios";

import store, { $token } from "../store";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const client = axios.create({
  baseURL: API_URL,
  responseType: "json",
});

// attach token to every request
client.interceptors.request.use((config) => {
  const token = store.get($token);
  if (token) config.headers.setAuthorization(`Bearer ${token}`);
  return config;
});

// log error responses globally
client.interceptors.response.use(undefined, (error) => {
  if (error instanceof AxiosError) {
    if (error.status === 401) {
      store.set($token, ""); // clear token on unauthorized
    }
    console.error(error.message);
  }
  return Promise.reject(error);
});

export default client;

export const createWebSocket = (endpoint: string): WebSocket => {
  const token = store.get($token);
  const url = `${API_URL.replace(/^http/, "ws")}/${endpoint}`;
  // @ts-expect-error: React Native WebSocket supports custom headers
  return new WebSocket(url, undefined, {
    headers: { Authorization: `Bearer ${token}` },
  });
};
