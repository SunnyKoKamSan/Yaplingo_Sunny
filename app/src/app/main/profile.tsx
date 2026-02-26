import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useAtomValue, useSetAtom } from "jotai";
import { ShoppingBagIcon } from "lucide-react-native";
import tw from "twrnc";

import { useAchievementsQuery, useAuthedUserQuery, useGemBalanceQuery } from "~/client";
import { AchievementGrid, Button, GemCounter, GemShop, Text } from "~/components";
import { $gemBalance, $token } from "~/store";

export default function MainProfileScreen() {
  const setToken = useSetAtom($token);
  const gemBalance = useAtomValue($gemBalance);
  const [shopVisible, setShopVisible] = useState(false);

  const { data: user } = useAuthedUserQuery();
  const { data: achievements } = useAchievementsQuery();
  useGemBalanceQuery();

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
    <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-12`}>
      {/* Profile Header */}
      <View style={tw`items-center pt-8 pb-4 gap-3`}>
        <View style={tw`w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/40 items-center justify-center border-2 border-green-400/40`}>
          <Text style={tw`text-3xl`}>🎙️</Text>
        </View>
        {!!user && (
          <Text style={tw`text-xl font-bold text-zinc-800 dark:text-zinc-100`}>@{user.name}</Text>
        )}
        <GemCounter />
      </View>

      {/* Gem Shop Button */}
      <View style={tw`px-6 mb-4`}>
        <Pressable
          onPress={() => setShopVisible(true)}
          style={tw`flex-row items-center justify-center gap-2 rounded-2xl border-2 border-green-400/40 bg-green-50 dark:bg-green-950/30 py-3`}
        >
          <ShoppingBagIcon size={18} color={tw.color("green-600")} />
          <Text style={tw`text-base font-bold text-green-700 dark:text-green-300`}>
            Gem Shop
          </Text>
        </Pressable>
      </View>

      {/* Achievements */}
      <View style={tw`px-4`}>
        <Text style={tw`text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-3`}>
          🏅 Achievements
        </Text>
        {achievements && achievements.length > 0 ? (
          <AchievementGrid achievements={achievements} />
        ) : (
          <View style={tw`items-center py-8`}>
            <Text style={tw`text-zinc-400 text-sm`}>
              Start practicing to unlock achievements!
            </Text>
          </View>
        )}
      </View>

      {/* Logout */}
      <View style={tw`items-center mt-8`}>
        <Button
          onPress={handleLogout}
          style={tw`border-transparent bg-red-500 px-6 py-2`}
          shadowColor={tw.color("red-400")}>
          <Text style={tw`text-base font-medium text-white`}>SIGN OUT</Text>
        </Button>
      </View>

      <GemShop
        visible={shopVisible}
        onClose={() => setShopVisible(false)}
        balance={gemBalance}
      />
    </ScrollView>
  );
}
