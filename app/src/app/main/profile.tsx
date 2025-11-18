import React from "react";
import { Alert, View } from "react-native";
import { useSetAtom } from "jotai";
import tw from "twrnc";

import { Button, Text } from "~/components";
import { $authed, $token } from "~/store";

export default function MainProfileScreen() {
  const setToken = useSetAtom($token);
  const setAuthed = useSetAtom($authed);

  const handleLogout = React.useCallback(() => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          setToken("");
          setAuthed(false);
        },
      },
    ]);
  }, [setToken, setAuthed]);

  return (
    <View style={tw`flex-1 items-center justify-center`}>
      <Button
        onPress={handleLogout}
        style={tw`border-transparent bg-red-500 px-6 py-2`}
        shadowColor={tw.color("red-400")}>
        <Text style={tw`text-base font-medium`}>SIGN OUT</Text>
      </Button>
    </View>
  );
}
