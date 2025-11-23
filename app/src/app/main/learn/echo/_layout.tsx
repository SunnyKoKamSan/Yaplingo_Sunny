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
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.7],
          sheetExpandsWhenScrolledToEdge: false,
        }}
      />
    </Stack>
  );
}
