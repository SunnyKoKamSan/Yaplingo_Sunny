import { View } from "react-native";
import tw from "twrnc";

import { Spinner, Text } from "./primitives";

export default function LoadingView() {
  return (
    <View style={tw`w-4/6 grow items-center justify-center gap-8`}>
      <Spinner size={48} />
      <Text style={tw`text-center text-base font-medium leading-tight text-neutral-500`}>
        Please ensure you are in a quiet environment for the best experience.
      </Text>
    </View>
  );
}
