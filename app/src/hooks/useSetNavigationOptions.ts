import { useEffect } from "react";
import { useNavigation } from "expo-router";

const useSetNavigationOptions = (options: any) => {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions(options);
  }, [navigation, options]);
};

export default useSetNavigationOptions;
