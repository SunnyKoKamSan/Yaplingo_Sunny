import React from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeftIcon, LockIcon, UserIcon } from "lucide-react-native";
import tw from "twrnc";

import { useLoginMutation } from "~/client";
import { Spinner, Text, TextInput } from "~/components/";
import { useFormReducer } from "~/utils";

export default function AccountLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const mutation = useLoginMutation();

  const [credentials, dispatch] = useFormReducer({ username: "", password: "" });

  const valid = !!credentials.username && !!credentials.password;

  const handleLogin = async () => {
    Keyboard.dismiss();
    mutation.mutate(credentials, {
      onSuccess: () => router.replace("/main"),
      onError: ({ status }) => {
        const message = status === 401 ? "Incorrect username or password." : "Please try again later.";
        Alert.alert("Login Failed", message);
      },
    });
  };

  return (
    <View style={[tw`flex-1`, { paddingBottom: insets.bottom }]}>
      <View style={tw`h-1/6 justify-end bg-sky-500 p-4`}>
        <View style={tw`flex-row items-center gap-4`}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={{ top: 48, bottom: 48, left: 16, right: 16 }}
            style={({ pressed }) => tw.style(pressed && "opacity-50")}>
            <ArrowLeftIcon color={tw.color("white")} size={24} strokeWidth={4} />
          </Pressable>
          <View>
            <Text style={tw`text-4xl font-bold text-white`}>SIGN IN</Text>
            <Text style={tw`text-xl font-bold text-white`}>to continue your learning progress</Text>
          </View>
        </View>
      </View>
      <KeyboardAvoidingView behavior="padding" style={tw`flex-grow justify-center gap-4 p-4`}>
        <View style={tw`gap-6`}>
          <View style={tw`gap-2`}>
            <Text style={tw`text-base font-medium text-neutral-500`}>CREDENTIALS</Text>
            <View style={tw`w-full`}>
              <TextInput
                Icon={UserIcon}
                autoCorrect={false}
                autoCapitalize="none"
                selectTextOnFocus={true}
                autoComplete="off"
                textContentType="username"
                placeholder="username"
                placeholderTextColor={tw.color("neutral-500/50")}
                style={tw`rounded-b-0`}
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
                style={tw`rounded-t-0 border-t-0`}
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
                  "mt-4 h-12 w-full items-center justify-center rounded-xl bg-sky-500",
                  (pressed || !valid || mutation.isPending) && "opacity-50",
                )
              }>
              {mutation.isPending ? (
                <Spinner color="white" />
              ) : (
                <Text style={tw`text-base font-medium text-white`}>SIGN IN</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
