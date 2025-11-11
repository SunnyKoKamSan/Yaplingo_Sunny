import React from "react";
import { TextInput as _TextInput, Pressable, View, type TextInputProps } from "react-native";
import { useTheme } from "@react-navigation/native";
import { EyeIcon, EyeOffIcon, LucideIcon } from "lucide-react-native";
import tw from "twrnc";

export default function TextInput({
  Icon,
  disabled,
  style,
  clearButtonMode,
  secureTextEntry,
  ...props
}: TextInputProps & {
  Icon?: LucideIcon;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [plain, setPlain] = React.useState(false);
  const RightIcon = plain ? EyeIcon : EyeOffIcon;
  return (
    <View style={tw`relative justify-center`}>
      <_TextInput
        style={[
          tw.style(
            "w-full rounded-lg border-2 p-2.5 text-lg leading-[0]",
            "border-neutral-500/50 bg-neutral-200/50 dark:bg-neutral-800/50",
            { color: theme.colors.text },
            Icon && "pl-10",
          ),
          style,
        ]}
        secureTextEntry={secureTextEntry ? !plain : false}
        clearButtonMode="never"
        editable={!disabled}
        readOnly={disabled}
        focusable={!disabled}
        {...props}
      />
      {Icon && <Icon color={tw.color("neutral-500")} size={24} style={tw`absolute left-2.5`} />}
      {secureTextEntry && (
        <Pressable style={tw`absolute right-2.5`} onPress={() => setPlain(!plain)}>
          <RightIcon color={tw.color("neutral-500/50")} size={24} />
        </Pressable>
      )}
    </View>
  );
}
