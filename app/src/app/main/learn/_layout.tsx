import { Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import { XIcon } from "lucide-react-native";
import tw from "twrnc";

export default function MainLearnLayout() {
  const router = useRouter();
  return (
    <Stack
      screenOptions={{
        presentation: "fullScreenModal",
        headerLeft: () => (
          <Pressable onPress={() => router.dismiss()} style={({ pressed }) => tw.style(pressed && "opacity-50")}>
            <XIcon color={tw.color("neutral-500")} size={26} strokeWidth={2.5} />
          </Pressable>
        ),
        headerTitleStyle: tw.style("text-2xl", {
          fontFamily: "DINNextRoundedLTW01-Bold",
        }),
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="echo" options={{ headerTitle: "Echoing" }} />
      <Stack.Screen name="yap" options={{ headerTitle: "Yapping" }} />
      <Stack.Screen name="chat" options={{ headerTitle: "Chatting" }} />
    </Stack>
  );
}
