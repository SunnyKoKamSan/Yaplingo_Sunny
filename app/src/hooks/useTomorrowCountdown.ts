import { useEffect, useState } from "react";

const getSecondsUntilTomorrow = () => {
  const now = new Date();
  const [hours, minutes, seconds] = [now.getHours(), now.getMinutes(), now.getSeconds()];
  return (24 - hours) * 3600 - minutes * 60 - seconds;
};

const formatSeconds = (s: number) => new Date(s * 1000).toISOString().slice(11, 19);

const useTomorrowCountdown = () => {
  const [seconds, setSeconds] = useState(getSecondsUntilTomorrow());

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(getSecondsUntilTomorrow());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return formatSeconds(seconds);
};

export default useTomorrowCountdown;
