import { useRef, useState } from "react";
import { Dimensions, Pressable, View, type ViewProps } from "react-native";
import { useTheme } from "@react-navigation/native";
import { Portal } from "@gorhom/portal";
import tw from "twrnc";

import { Text } from "~/components";

const GAP = 8;

const WINDOW_WIDTH = Dimensions.get("window").width;

export default function Tooltip({
  children,
  content,
  style,
}: {
  content: string | React.ReactNode;
  children: (visible: boolean) => React.ReactNode;
} & Omit<ViewProps, "children">) {
  const theme = useTheme();

  const ref = useRef<View>(null);

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left?: number; right?: number } | null>(null);

  const handlePress = () => {
    ref.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setVisible(true);
      setPosition({
        top: pageY + height + GAP,
        left: pageX <= (WINDOW_WIDTH * 2) / 3 ? pageX - width / 2 : undefined,
        right: pageX > (WINDOW_WIDTH * 2) / 3 ? WINDOW_WIDTH - pageX - width / 2 : undefined,
      });
    });
  };

  const handleClose = () => {
    setVisible(false);
    setPosition(null);
  };

  return (
    <>
      <Pressable ref={ref} onPress={handlePress}>
        {children(visible)}
      </Pressable>
      {visible && position && (
        <Portal>
          <Pressable style={tw`absolute inset-0`} onPressIn={handleClose}>
            <View
              style={[
                tw`absolute rounded-lg border px-1.5 py-1`,
                {
                  top: position.top,
                  left: position.left,
                  right: position.right,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                },
                style,
              ]}>
              {typeof content === "string" ? <Text style={tw`text-center`}>{content}</Text> : content}
            </View>
          </Pressable>
        </Portal>
      )}
    </>
  );
}
