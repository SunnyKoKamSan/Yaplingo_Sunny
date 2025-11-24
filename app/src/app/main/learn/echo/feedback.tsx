import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import tw from "twrnc";

import { useEchoResultQuery } from "~/client";
import { Text } from "~/components";

// TODO: to be implemented
export default function MainLearnEchoFeedbackScreen() {
  const { tid } = useLocalSearchParams<{ tid: string }>();
  const { data: result, ...query } = useEchoResultQuery(tid);

  if (query.isPending) return null;

  return (
    <View style={tw`flex-1`}>
      <Text style={tw`text-red-500`}>{result?.feedback.text}</Text>
    </View>
  );
}
