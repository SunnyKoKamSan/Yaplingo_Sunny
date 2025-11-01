import React from "react";
import { TextInput as _TextInput, Pressable, View, type TextInputProps } from "react-native";
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
  const [plain, setPlain] = React.useState(false);
  const RightIcon = plain ? EyeIcon : EyeOffIcon;
  return (
    <View style={tw`relative justify-center`}>
      <_TextInput
        style={[tw.style("w-full p-2.5 text-lg leading-[0]", Icon && "pl-10"), style]}
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
