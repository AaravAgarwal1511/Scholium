import { useEffect, useState } from 'react';

interface CloudSync {
  load: () => Promise<boolean | null>;
  save: () => Promise<void>;
  reset: () => Promise<void>;
}

export function useTourCompleted(appKey: string, cloud?: CloudSync) {
  const localKey = `scholium-onboarding-${appKey}`;
  const [completed, setCompleted] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(localKey) === 'true';
  });

  // On mount: if not already completed locally, check cloud (cross-device sync)
  useEffect(() => {
    if (!cloud || completed) return;
    cloud.load().then(cloudDone => {
      if (cloudDone === true) {
        localStorage.setItem(localKey, 'true');
        setCompleted(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount only

  async function complete() {
    localStorage.setItem(localKey, 'true');
    setCompleted(true);
    if (cloud) cloud.save().catch(() => {});
  }

  async function reset() {
    localStorage.removeItem(localKey);
    setCompleted(false);
    if (cloud) await cloud.reset();
  }

  return { completed, complete, reset };
}

function isDarkMode() {
  return (
    document.documentElement.classList.contains('dark') ||
    document.documentElement.getAttribute('data-theme') === 'dark'
  );
}

// In joyride v3, colors must be set as explicit style overrides — `options.primaryColor`
// is a top-level <Joyride> prop, not a key inside the `styles` prop. Passing it inside
// `styles` does nothing. We set all color-sensitive styles explicitly here instead.

const sharedFont = "'Nunito', system-ui, sans-serif";

function buildStyles(dark: boolean) {
  const primary = dark ? '#ffffff' : 'hsl(220, 70%, 45%)';
  const bg      = dark ? '#1e2433' : '#ffffff';
  const text    = dark ? '#e2e8f0' : '#1a2340';

  return {
    tooltip: {
      borderRadius: '12px',
      fontSize: '0.875rem',
      fontFamily: sharedFont,
      padding: '1.25rem 1.375rem',
      boxShadow: '0 8px 30px -8px rgba(34, 42, 88, 0.28)',
      backgroundColor: bg,
      color: text,
    },
    tooltipTitle: {
      fontWeight: '800',
      fontSize: '0.9375rem',
      marginBottom: '0.35rem',
    },
    tooltipContent: {
      paddingTop: '0.2rem',
      lineHeight: '1.6',
    },
    buttonNext: {
      borderRadius: '8px',
      fontWeight: '700',
      fontFamily: sharedFont,
      padding: '0.45rem 1rem',
      fontSize: '0.8125rem',
      backgroundColor: primary,
      color: dark ? '#0f172a' : '#ffffff',
    },
    buttonBack: {
      fontWeight: '600',
      fontFamily: sharedFont,
      marginRight: '0.25rem',
      fontSize: '0.8125rem',
      color: dark ? '#94a3b8' : '#6b7280',
    },
    buttonSkip: {
      fontFamily: sharedFont,
      fontSize: '0.8125rem',
      color: dark ? '#64748b' : '#9ca3af',
    },
    beaconInner: {
      backgroundColor: primary,
    },
    beaconOuter: {
      backgroundColor: dark ? 'rgba(255,255,255,0.2)' : 'hsla(220,70%,45%,0.2)',
      border: `2px solid ${primary}`,
    },
  };
}

export const tourStyles = buildStyles(false);

export function useTourStyles() {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' ? isDarkMode() : false,
  );

  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDarkMode()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return buildStyles(dark);
}
