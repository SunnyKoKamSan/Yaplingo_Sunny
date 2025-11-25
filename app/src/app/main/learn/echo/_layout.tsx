import { Stack } from "expo-router";

export default function MainLearnEchoLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="feedback"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetGrabberVisible: false,
          sheetAllowedDetents: [0.5],
          sheetExpandsWhenScrolledToEdge: false,
        }}
      />
    </Stack>
  );
}
