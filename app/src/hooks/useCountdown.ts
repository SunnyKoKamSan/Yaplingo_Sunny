import { useEffect, useState } from "react";

const getSecondsUntil = (target: Date) => {
  const now = new Date();
  return Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
};

const formatSeconds = (s: number) => new Date(s * 1000).toISOString().slice(11, 19);

const useCountdown = (target?: Date | null) => {
  const [seconds, setSeconds] = useState(target ? getSecondsUntil(target) : 0);

  useEffect(() => {
    if (!target) return;
    const interval = setInterval(() => {
      setSeconds(getSecondsUntil(target));
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  return formatSeconds(seconds);
};

export default useCountdown;
