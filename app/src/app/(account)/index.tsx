import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import tw from "twrnc";

export default function AccountIndexScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={tw`flex-1 p-4`}>
      <View style={tw`flex-grow items-center justify-center gap-4`}>
        <Image source={require("@/mascot.png")} style={tw`size-32`} />
        <Text style={[tw`text-5xl text-green-500`, { fontFamily: "Feather-Bold" }]}>yaplingo</Text>
        <Text style={tw`text-xl font-medium text-neutral-500`}>Your Pronunciation Learning App</Text>
      </View>
      <View style={tw`gap-4`}>
        <Pressable
          onPress={() => router.navigate("/(account)/register")}
          style={({ pressed }) =>
            tw.style("h-12 items-center justify-center rounded-xl bg-green-500", pressed && "opacity-50")
          }>
          <Text style={tw`text-base font-bold text-white dark:text-black`}>GET STARTED</Text>
        </Pressable>
        <Pressable
          onPress={() => router.navigate("/(account)/login")}
          style={({ pressed }) =>
            tw.style(
              "h-12 items-center justify-center rounded-xl border-2 border-neutral-500/50",
              pressed && "opacity-50",
            )
          }>
          <Text style={tw`text-base font-bold text-green-500`}>I ALREADY HAVE AN ACCOUNT</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
