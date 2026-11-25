import { useId } from 'react';
import { StarRating } from './FeedbackDialog';
import './feedback.css';

export type FeedbackPromptStatus = 'idle' | 'sending' | 'sent' | 'error';

export interface FeedbackPromptProps {
  /** e.g. "Recall". Falls back to "Scholium". */
  appName?: string;
  /** Where the quick rating is: the owner sends it and updates `status`. */
  status?: FeedbackPromptStatus;
  /** The rating that was sent (keeps the stars lit while sending / after). */
  rating?: number | null;
  /** Shown when `status` is "error". */
  errorMessage?: string;
  /** A star was clicked — the owner submits the rating on its own, no form. */
  onRate: (rating: number) => void;
  /** "Write a message instead" / "Tell us more" — open the full dialog. */
  onOpenForm: () => void;
  onDismiss: () => void;
}

/** Small non-modal card in the bottom-right corner asking for a one-click rating.
 *  Rendering only: when to show it, and sending the rating, belong to the caller
 *  (@repo/feedback). */
export function FeedbackPrompt({
  appName,
  status = 'idle',
  rating = null,
  errorMessage,
  onRate,
  onOpenForm,
  onDismiss,
}: FeedbackPromptProps) {
  const id = useId();
  const name = appName ?? 'Scholium';

  if (status === 'sent') {
    return (
      <aside className="rui-fb-prompt" aria-labelledby={`${id}-t`}>
        <div className="rui-fb-prompt-head">
          <p id={`${id}-t`} className="rui-fb-prompt-title" role="status">
            Thanks! Your rating was sent.
          </p>
          <button type="button" className="rui-fb-close" onClick={onDismiss} aria-label="Close">
            ×
          </button>
        </div>
        <button type="button" className="rui-fb-prompt-link" onClick={onOpenForm}>
          Tell us more
        </button>
      </aside>
    );
  }

  return (
    <aside className="rui-fb-prompt" aria-labelledby={`${id}-t`} aria-busy={status === 'sending'}>
      <div className="rui-fb-prompt-head">
        <p id={`${id}-t`} className="rui-fb-prompt-title">
          How's {name} working for you?
        </p>
        <button type="button" className="rui-fb-close" onClick={onDismiss} aria-label="Dismiss feedback prompt">
          ×
        </button>
      </div>
      <p className="rui-fb-prompt-sub">One click. It really helps.</p>
      <fieldset className="rui-fb-fieldset">
        <legend className="rui-fb-sr">Rate {name}</legend>
        <StarRating name={`${id}-rating`} value={rating} onChange={onRate} disabled={status === 'sending'} />
      </fieldset>
      <div aria-live="polite">
        {status === 'error' && errorMessage ? (
          <p className="rui-fb-error rui-fb-prompt-error">{errorMessage}</p>
        ) : null}
      </div>
      <button type="button" className="rui-fb-prompt-link" onClick={onOpenForm}>
        Write a message instead
      </button>
    </aside>
  );
}
