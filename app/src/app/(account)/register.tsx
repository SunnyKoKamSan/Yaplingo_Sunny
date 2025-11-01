import { Alert, Keyboard, KeyboardAvoidingView, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import tw from "twrnc";

import { useRegisterMutation } from "~/client";
import { Spinner, TextInput } from "~/components/";
import { useFormReducer } from "~/utils";

export default function AccountRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const mutation = useRegisterMutation();

  const [form, dispatch] = useFormReducer({ username: "", password: "", passwordConfirm: "" });

  const handleRegister = () => {
    Keyboard.dismiss();
    mutation.mutate(form, {
      onSuccess: () => router.replace("/main"),
      onError: () => Alert.alert("Register Failed", "Please try again later."),
    });
  };

  const valid = !!form.username && !!form.password && form.password === form.passwordConfirm;

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={tw.style("flex-1 justify-center gap-4 p-4", {
        paddingBottom: insets.bottom,
      })}>
      <View style={tw`gap-6`}>
        {/* <Text style={tw`text-lg font-bold text-neutral-500`}>NEW ACCOUNT</Text> */}
        <View style={tw`gap-2`}>
          <Text style={tw`text-sm font-bold text-neutral-500`}>USERNAME</Text>
          <TextInput
            autoFocus={true}
            autoCorrect={false}
            autoCapitalize="none"
            selectTextOnFocus={true}
            autoComplete="off"
            textContentType="username"
            placeholder="username"
            placeholderTextColor={tw.color("neutral-500/50")}
            style={tw`rounded-lg border-2 border-neutral-500/50 bg-neutral-200/50`}
            value={form.username}
            onChangeText={(text) => dispatch({ field: "username", value: text.trim() })}
            disabled={mutation.isPending}
          />
        </View>
        <View style={tw`gap-2`}>
          <Text style={tw`text-sm font-bold text-neutral-500`}>PASSWORD</Text>
          <View style={tw`w-full`}>
            <TextInput
              secureTextEntry={true}
              clearTextOnFocus={true}
              clearButtonMode="always"
              textContentType="password"
              placeholder="new password"
              placeholderTextColor={tw.color("neutral-500/50")}
              style={tw`rounded-b-0 rounded-lg border-2 border-neutral-500/50 bg-neutral-200/50`}
              value={form.password}
              onChangeText={(value) => dispatch({ field: "password", value })}
              disabled={mutation.isPending}
            />
            <TextInput
              secureTextEntry={true}
              clearTextOnFocus={true}
              clearButtonMode="always"
              textContentType="password"
              placeholder="confirm password"
              placeholderTextColor={tw.color("neutral-500/50")}
              style={tw`rounded-t-0 rounded-lg border-2 border-t-0 border-neutral-500/50 bg-neutral-200/50`}
              value={form.passwordConfirm}
              onChangeText={(value) => dispatch({ field: "passwordConfirm", value })}
              disabled={mutation.isPending}
            />
          </View>
        </View>
        <Pressable
          disabled={!valid || mutation.isPending}
          onPress={handleRegister}
          style={({ pressed }) =>
            tw.style(
              "h-12 w-full items-center justify-center rounded-xl bg-sky-500",
              (pressed || !valid || mutation.isPending) && "opacity-50",
            )
          }>
          {mutation.isPending ? <Spinner /> : <Text style={tw`text-base font-bold text-white`}>SIGN UP</Text>}
        </Pressable>
      </View>
      <Text style={tw`text-sm font-medium text-neutral-500`}>
        By signing up for an account, you get access to personalized features and content.
      </Text>
    </KeyboardAvoidingView>
  );
}
