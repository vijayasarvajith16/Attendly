// Today's date as 'YYYY-MM-DD', kept current across midnight and when the app
// returns to the foreground (e.g. left open overnight).

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { startOfTomorrow } from 'date-fns';

import { todayISO } from '../utils/dates';

export function useToday(): string {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    const refresh = () => setToday(todayISO());

    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      timer = setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, startOfTomorrow().getTime() - Date.now() + 1000);
    };
    scheduleMidnight();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}
