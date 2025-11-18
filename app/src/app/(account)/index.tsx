import { Image, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import tw from "twrnc";

import { Text } from "~/components";

export default function AccountIndexScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={tw`flex-1 p-4`}>
      <View style={tw`flex-grow items-center justify-center gap-4`}>
        <Image source={require("@/mascot.png")} style={tw`mb-4 size-32`} />
        <Text style={[tw`text-5xl text-green-500`, { fontFamily: "Feather-Bold" }]}>yaplingo</Text>
        <Text style={[tw`text-2xl`, { fontFamily: "Feather-Bold" }]}>enjoy pronunciation learning</Text>
      </View>
      <View style={tw`gap-4`}>
        <Pressable
          onPress={() => router.navigate("/(account)/register")}
          style={({ pressed }) =>
            tw.style("h-12 items-center justify-center rounded-xl bg-green-500", pressed && "opacity-50")
          }>
          <Text style={tw`text-base font-medium text-white`}>GET STARTED</Text>
        </Pressable>
        <Pressable
          onPress={() => router.navigate("/(account)/login")}
          style={({ pressed }) =>
            tw.style("h-12 items-center justify-center rounded-xl border-2 border-zinc-500/50", pressed && "opacity-50")
          }>
          <Text style={tw`text-base font-medium text-green-500`}>I ALREADY HAVE AN ACCOUNT</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
