import React from "react";
import { Alert, Pressable } from "react-native";
import { useNavigation } from "expo-router";
import { useSetAtom } from "jotai";
import { LogOutIcon } from "lucide-react-native";
import tw from "twrnc";

import { $authed, $token } from "~/store";

export default function MainProfileScreen() {
  const navigation = useNavigation();

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

  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleLogout} style={({ pressed }) => tw.style(pressed && "opacity-50")}>
          <LogOutIcon size={26} color={tw.color("red-500")} />
        </Pressable>
      ),
    });
  }, [navigation, handleLogout]);

  return <></>;
}
