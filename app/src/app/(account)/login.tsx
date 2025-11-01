import React from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRouter } from "expo-router";
import { LockIcon, UserIcon } from "lucide-react-native";
import tw from "twrnc";

import { useLoginMutation } from "~/client";
import { Spinner, TextInput } from "~/components/";
import { useFormReducer } from "~/utils";

export default function AccountLoginScreen() {
  const router = useRouter();
  const offset = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const mutation = useLoginMutation();

  const [credentials, dispatch] = useFormReducer({ username: "", password: "" });

  const valid = !!credentials.username && !!credentials.password;

  const handleLogin = async () => {
    Keyboard.dismiss();
    mutation.mutate(credentials, {
      onSuccess: () => router.replace("/main"),
      onError: ({ status }) => {
        const message = status === 401 ? "Invalid username or password." : "Please try again later.";
        Alert.alert("Login Failed", message);
      },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={offset}
      style={tw.style("flex-1 justify-center gap-4 p-4", {
        paddingBottom: insets.bottom,
      })}>
      <View style={tw`gap-6`}>
        {/* <Text style={tw`text-lg font-bold text-neutral-500`}>EXISTING ACCOUNT</Text> */}
        <View style={tw`w-full`}>
          <TextInput
            Icon={UserIcon}
            autoFocus={true}
            autoCorrect={false}
            autoCapitalize="none"
            selectTextOnFocus={true}
            autoComplete="off"
            textContentType="username"
            placeholder="username"
            placeholderTextColor={tw.color("neutral-500/50")}
            style={tw`rounded-b-0 rounded-lg border-2 border-neutral-500/50 bg-neutral-200/50`}
            value={credentials.username}
            onChangeText={(text) => dispatch({ field: "username", value: text.trim() })}
            disabled={mutation.isPending}
          />
          <TextInput
            Icon={LockIcon}
            secureTextEntry={true}
            clearTextOnFocus={true}
            clearButtonMode="always"
            textContentType="password"
            placeholder="password"
            placeholderTextColor={tw.color("neutral-500/50")}
            style={tw`rounded-t-0 rounded-lg border-2 border-t-0 border-neutral-500/50 bg-neutral-200/50`}
            value={credentials.password}
            onChangeText={(value) => dispatch({ field: "password", value })}
            disabled={mutation.isPending}
          />
        </View>
        <Pressable
          disabled={!valid || mutation.isPending}
          onPress={handleLogin}
          style={({ pressed }) =>
            tw.style(
              "h-12 w-full items-center justify-center rounded-xl bg-sky-500",
              (pressed || !valid || mutation.isPending) && "opacity-50",
            )
          }>
          {mutation.isPending ? <Spinner /> : <Text style={tw`text-base font-bold text-white`}>SIGN IN</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
