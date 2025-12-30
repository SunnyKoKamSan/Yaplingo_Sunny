import { Alert, Keyboard, KeyboardAvoidingView, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import tw from "twrnc";

import { useRegisterMutation } from "~/client";
import { Spinner, Text, TextInput } from "~/components/";
import { useFormReducer, useNavigationOptions } from "~/hooks";

const Header = () => (
  <View style={tw`bg-green-500 p-6`}>
    <Text style={tw`text-4xl font-bold text-white`}>SIGN UP</Text>
    <Text style={tw`text-xl font-bold text-white`}>to start your learning journey</Text>
  </View>
);

export default function AccountRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const mutation = useRegisterMutation();

  const [form, dispatch] = useFormReducer({ username: "", password: "", passwordConfirm: "" });

  const handleRegister = () => {
    Keyboard.dismiss();
    mutation.mutate(form, {
      onSuccess: () => router.replace("/main"),
      onError: ({ status }) => {
        const message =
          status === 409
            ? "Username already taken."
            : status === 400
              ? "Invalid username or password."
              : "Please try again later.";
        Alert.alert("Register Failed", message);
      },
    });
  };

  const valid = !!form.username && !!form.password && form.password === form.passwordConfirm;

  useNavigationOptions({ header: () => <Header /> });

  return (
    <View style={[tw`flex-1`, { paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView behavior="padding" style={tw`flex-grow justify-center gap-4 p-4`}>
        <View style={tw`gap-6`}>
          <View style={tw`gap-2`}>
            <Text style={tw`text-base font-medium text-neutral-500`}>USERNAME</Text>
            <TextInput
              autoCorrect={false}
              autoCapitalize="none"
              selectTextOnFocus={true}
              autoComplete="off"
              textContentType="username"
              placeholder="username"
              placeholderTextColor={tw.color("neutral-500/50")}
              value={form.username}
              onChangeText={(text) => dispatch({ field: "username", value: text.trim().toLowerCase() })}
              disabled={mutation.isPending}
            />
            <Text style={tw`text-sm font-medium text-neutral-500`}>
              Only lowercase letters, numbers, and underscores. Between 2 and 32 characters.
            </Text>
          </View>
          <View style={tw`gap-2`}>
            <Text style={tw`text-base font-medium text-neutral-500`}>PASSWORD</Text>
            <View style={tw`w-full`}>
              <TextInput
                secureTextEntry={true}
                clearTextOnFocus={true}
                clearButtonMode="always"
                textContentType="password"
                placeholder="new password"
                placeholderTextColor={tw.color("neutral-500/50")}
                style={tw`rounded-b-0`}
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
                style={tw`rounded-t-0 border-t-0`}
                value={form.passwordConfirm}
                onChangeText={(value) => dispatch({ field: "passwordConfirm", value })}
                disabled={mutation.isPending}
              />
            </View>
            <Text style={tw`text-sm font-medium text-neutral-500`}>
              Between 8 and 128 characters. Both passwords must match.
            </Text>
          </View>
          <Pressable
            disabled={!valid || mutation.isPending}
            onPress={handleRegister}
            style={({ pressed }) =>
              tw.style(
                "h-12 w-full items-center justify-center rounded-xl bg-green-500",
                (pressed || !valid || mutation.isPending) && "opacity-50",
              )
            }>
            {mutation.isPending ? (
              <Spinner color="white" />
            ) : (
              <Text style={tw`text-base font-medium text-white`}>SIGN UP</Text>
            )}
          </Pressable>
        </View>
        <Text style={tw`text-sm font-medium text-neutral-500`}>
          By signing up for an account, you get access to personalized features and content.
        </Text>
      </KeyboardAvoidingView>
    </View>
  );
}
