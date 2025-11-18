import { Stack } from "expo-router";

export default function MainLearnEchoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="feedback"
        options={{
          presentation: "formSheet",
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.7],
          sheetExpandsWhenScrolledToEdge: false,
        }}
      />
    </Stack>
  );
}
