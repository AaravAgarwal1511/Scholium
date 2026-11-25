import { ScholiumFooter, type ScholiumFooterProps } from '@repo/ui';
import { useFeedback } from './useFeedback';

/** The shared footer with its "Send feedback" control wired to the nearest
 *  FeedbackProvider. Apps render this instead of ScholiumFooter — it has to be a
 *  component (not a prop at the call site) because several apps render their
 *  footer in the same component that mounts the provider. */
export function FeedbackFooter(props: Omit<ScholiumFooterProps, 'onFeedback'>) {
  const { open } = useFeedback();
  return <ScholiumFooter {...props} onFeedback={() => open({ source: 'form' })} />;
}
