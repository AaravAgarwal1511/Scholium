import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import './feedback.css';

export type FeedbackCategory = 'bug' | 'idea' | 'other';

export interface FeedbackValues {
  category: FeedbackCategory;
  rating: number | null;
  message: string;
  /** Honeypot. Always '' from a human; pass it through to the server untouched. */
  website: string;
}

export interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  /** Resolve on success; reject with an Error whose message is shown to the user. */
  onSubmit: (values: FeedbackValues) => Promise<void>;
  /** Prefill — e.g. the prompt passes the rating that was clicked, the error
   *  boundary passes category "bug" and the error text. Applied each time the
   *  dialog opens. */
  initialCategory?: FeedbackCategory;
  initialRating?: number | null;
  initialMessage?: string;
  /** Shown in the subtitle, e.g. "Recall". */
  appName?: string;
}

export const FEEDBACK_MAX_LENGTH = 2000;

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idea' },
  { value: 'other', label: 'Other' },
];

type Status = 'idle' | 'sending' | 'sent' | 'error';

/** Modal feedback form. Rendering only — the submit transport is injected.
 *  Built on the native <dialog> so focus trapping, Escape-to-close and an inert
 *  page behind it come from the browser rather than hand-rolled code. */
export function FeedbackDialog({ open, onClose, ...body }: FeedbackDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  // Drive the native dialog from the `open` prop.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);

  // Escape → tell the owner, so `open` stays the single source of truth.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener('cancel', onCancel);
    return () => el.removeEventListener('cancel', onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className="rui-fb-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-desc`}
      onClick={(e) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (e.target === ref.current) onClose();
      }}
    >
      {/* Mounted only while open, so every opening starts from the prefill. */}
      {open ? <FeedbackBody id={id} onClose={onClose} {...body} /> : null}
    </dialog>
  );
}

type BodyProps = Omit<FeedbackDialogProps, 'open'> & { id: string };

function FeedbackBody({
  id,
  onClose,
  onSubmit,
  initialCategory = 'other',
  initialRating = null,
  initialMessage = '',
  appName,
}: BodyProps) {
  const [category, setCategory] = useState<FeedbackCategory>(initialCategory);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [message, setMessage] = useState(initialMessage);
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const trimmed = message.trim();
  const canSubmit = status !== 'sending' && (trimmed.length > 0 || rating !== null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus('sending');
    setError('');
    try {
      await onSubmit({ category, rating, message: trimmed, website });
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.');
    }
  }

  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  if (status === 'sent') {
    return (
      <div className="rui-fb-done" role="status" aria-live="polite">
        <span className="rui-fb-done-mark" aria-hidden="true">✓</span>
        <h2 id={titleId} className="rui-fb-title">Thanks for your feedback</h2>
        <p id={descId} className="rui-fb-sub">It goes straight to the person who builds Scholium.</p>
        <button type="button" className="rui-fb-btn rui-fb-btn--primary" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    );
  }

  return (
    <form className="rui-fb-form" onSubmit={handleSubmit} noValidate>
      <div className="rui-fb-head">
        <div>
          <h2 id={titleId} className="rui-fb-title">Send feedback</h2>
          <p id={descId} className="rui-fb-sub">
            Tell us what's working{appName ? ` in ${appName}` : ''} and what isn't.
          </p>
        </div>
        <button type="button" className="rui-fb-close" onClick={onClose} aria-label="Close feedback form">
          ×
        </button>
      </div>

      <fieldset className="rui-fb-fieldset">
        <legend className="rui-fb-legend">What's it about?</legend>
        <div className="rui-fb-segments">
          {CATEGORIES.map((c) => (
            <label key={c.value} className="rui-fb-segment">
              <input
                type="radio"
                name={`${id}-category`}
                value={c.value}
                checked={category === c.value}
                onChange={() => setCategory(c.value)}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rui-fb-fieldset">
        <legend className="rui-fb-legend">
          How would you rate it? <span className="rui-fb-optional">(optional)</span>
        </legend>
        <StarRating name={`${id}-rating`} value={rating} onChange={setRating} />
      </fieldset>

      <div>
        <label className="rui-fb-label" htmlFor={`${id}-message`}>
          Your message
        </label>
        <textarea
          id={`${id}-message`}
          className="rui-fb-textarea"
          value={message}
          maxLength={FEEDBACK_MAX_LENGTH}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            category === 'bug'
              ? 'What happened, and what did you expect?'
              : category === 'idea'
                ? 'What would make this better?'
                : 'Anything on your mind'
          }
          aria-describedby={`${id}-hint`}
          autoFocus
        />
        <div className="rui-fb-meta" id={`${id}-hint`}>
          <span>Please don't include personal information.</span>
          <span aria-hidden="true">
            {message.length}/{FEEDBACK_MAX_LENGTH}
          </span>
        </div>
      </div>

      <div className="rui-fb-hp" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <div aria-live="polite">
        {status === 'error' && error ? <p className="rui-fb-error">{error}</p> : null}
      </div>

      <div className="rui-fb-actions">
        <button type="button" className="rui-fb-btn rui-fb-btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="rui-fb-btn rui-fb-btn--primary" disabled={!canSubmit}>
          {status === 'sending' ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  );
}

export interface StarRatingProps {
  name: string;
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

/** Five native radios styled as stars — arrow keys, labels and checked state
 *  all come from the platform. Hovering (or keyboard-focusing) a star previews
 *  the rating by lighting every star up to it. */
export function StarRating({ name, value, onChange, disabled }: StarRatingProps) {
  const [preview, setPreview] = useState<number | null>(null);
  const lit = preview ?? value ?? 0;
  return (
    <div className="rui-fb-stars" onMouseLeave={() => setPreview(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <label
          key={n}
          className={`rui-fb-star${n <= lit ? ' is-lit' : ''}`}
          onMouseEnter={() => !disabled && setPreview(n)}
        >
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            disabled={disabled}
            onChange={() => onChange(n)}
            onFocus={() => setPreview(n)}
            onBlur={() => setPreview(null)}
            aria-label={`${n} out of 5`}
          />
          <span aria-hidden="true">★</span>
        </label>
      ))}
    </div>
  );
}
