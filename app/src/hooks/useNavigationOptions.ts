import { useEffect } from "react";
import { useNavigation } from "expo-router";

const useNavigationOptions = (options: any) => {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions(options);
  }, [navigation, options]);
};

export default useNavigationOptions;
