import { useTourCompleted } from '@repo/hooks';
import { supabase } from '@/integrations/supabase/client';

function metaKey(key: string) {
  return `onboarding_${key.replace(/-/g, '_')}_done`;
}

function makeCloud(key: string) {
  const mk = metaKey(key);
  return {
    load: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.user_metadata?.[mk] === true ? true : null;
    },
    save: async () => {
      await supabase.auth.updateUser({ data: { [mk]: true } });
    },
    reset: async () => {
      await supabase.auth.updateUser({ data: { [mk]: false } });
    },
  };
}

export function useTour(key: string) {
  return useTourCompleted(key, makeCloud(key));
}

export async function resetTours(...keys: string[]) {
  keys.forEach(k => localStorage.removeItem(`scholium-onboarding-${k}`));
  const data: Record<string, boolean> = {};
  keys.forEach(k => { data[metaKey(k)] = false; });
  await supabase.auth.updateUser({ data });
}
