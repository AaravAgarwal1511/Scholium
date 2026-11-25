# @repo/feedback

Suite-wide user feedback: a "Send feedback" footer link, a periodic bottom-right
prompt, and a "Report this problem" button for error screens. Every app mounts it.

| Piece | Where |
| --- | --- |
| Dialog + prompt UI (rendering only) | `@repo/ui` → `FeedbackDialog`, `FeedbackPrompt`, `feedback.css` |
| Provider, scheduling, submit | this package |
| Table, RPCs, rate limit, email trigger, 2-year retention | `database/migrations/20261122000000_feedback.sql` |
| Email sender | `supabase/functions/feedback-notify` (Resend) |
| Reading + triage | admin dashboard → **Feedback** tab |

## Using it in an app

```tsx
// Inside AnalyticsProvider (so submissions are counted), inside the auth context:
<FeedbackProvider supabase={supabase} appKey="recall-app" appName="Recall" suppressPromptOn={["/signin"]}>
  {children}
</FeedbackProvider>

// Footer with the feedback link:
<FeedbackFooter homeUrl={SCHOLIUM_HOME_URL} />

// Anywhere below the provider:
const { open } = useFeedback();
open({ category: "bug" });

// In an ErrorBoundary (above every provider — needs none):
<ReportProblemButton supabase={supabase} appKey="recall-app" error={error} />
```

## The prompt's schedule

Per browser, per app (localStorage `scholium-feedback-prompt`):

- not before the **3rd visit** (one visit per tab session), and only after **2 minutes** on the page;
- at most **once every 30 days**, whether it was rated, dismissed or ignored;
- not for **90 days** after the user sends any feedback;
- never on paths in `suppressPromptOn` (sign-in everywhere; `/attempt` and `/demo` in mock-space).

Add `?feedbackPrompt=1` to any URL to force it after half a second, for QA.

## Privacy & abuse

- Free text never goes to analytics. Only `feedback_submitted {category, rating, source, has_message}` is sent.
- The `feedback` table grants nothing to client roles. Writes go only through `submit_feedback()`, which sets `user_id` from the JWT. Reads go only through `admin_*` RPCs.
- Signed-out visitors can submit. Abuse is limited in three ways:
  - **Rate limit:** 5 submissions per hour per user, or per daily-salted IP hash for signed-out visitors. The raw IP is never stored.
  - **Global cap:** 100 signed-out submissions per hour across all visitors.
  - **Honeypot:** a hidden field that real users never fill in.

## Turning on email alerts (per environment)

The trigger does nothing until both Vault secrets exist, so local and staging stay quiet by default.

1. Create a [Resend](https://resend.com) API key, and verify the sender domain (`thescholium.com`).
2. Deploy the function and set its secrets:
   ```bash
   supabase functions deploy feedback-notify
   supabase secrets set RESEND_API_KEY=re_… FEEDBACK_WEBHOOK_SECRET=<long random string>
   # optional: FEEDBACK_TO_EMAIL=… FEEDBACK_FROM_EMAIL="Scholium Feedback <feedback@thescholium.com>"
   ```
3. In the SQL editor, store the URL and **the same** secret in Vault. This is configuration, not schema, so it doesn't belong in a migration:
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/feedback-notify', 'feedback_notify_url');
   select vault.create_secret('<same long random string>', 'feedback_webhook_secret');
   ```

At most 20 alerts are sent per UTC day. Submission 21 sends one "alerts paused" email to the admin. After that, nothing is emailed until the next day, but every submission is still saved.
