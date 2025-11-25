import { View } from "react-native";
import tw from "twrnc";

import { Text } from "~/components";

export default function MainCommunityScreen() {
  return (
    <View style={tw`flex-1 items-center justify-center`}>
      <Text style={tw`text-lg font-medium text-zinc-500`}>COMING SOON</Text>
    </View>
  );
}
