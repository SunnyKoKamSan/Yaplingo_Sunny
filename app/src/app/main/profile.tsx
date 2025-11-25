import { useCallback } from "react";
import { Alert, View } from "react-native";
import { useSetAtom } from "jotai";
import tw from "twrnc";

import { useAuthedUserQuery } from "~/client";
import { Button, Text } from "~/components";
import { $token } from "~/store";

export default function MainProfileScreen() {
  const setToken = useSetAtom($token);

  const { data: user } = useAuthedUserQuery();

  const handleLogout = useCallback(() => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => setToken(""),
      },
    ]);
  }, [setToken]);

  return (
    <View style={tw`flex-1 items-center justify-center gap-5`}>
      {!!user && <Text style={tw`text-lg`}>@{user.name}</Text>}
      <Button
        onPress={handleLogout}
        style={tw`border-transparent bg-red-500 px-6 py-2`}
        shadowColor={tw.color("red-400")}>
        <Text style={tw`text-base font-medium text-white`}>SIGN OUT</Text>
      </Button>
    </View>
  );
}
