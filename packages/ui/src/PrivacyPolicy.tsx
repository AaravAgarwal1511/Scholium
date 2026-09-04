import { LegalPage } from './LegalPage';
import type { LegalDocProps } from './TermsOfService';

const DEFAULT_UPDATED = '26 August 2026';

/** Suite-wide Privacy Policy, shared across every Scholium app. */
export function PrivacyPolicy({ lastUpdated = DEFAULT_UPDATED, homeUrl }: LegalDocProps) {
  return (
    <LegalPage title="Privacy Policy" lastUpdated={lastUpdated} homeUrl={homeUrl}>
      <p>
        This Privacy Policy explains how Vivek Agarwal (“Scholium”, “we”, “us”) handles
        personal data across the Scholium suite — Language Hub, Recall, Poetry Notes, Past
        Papers, Mock Space, Notes, and the Scholium home site (the “Service”). We are the data
        controller. For privacy questions, contact admin@thescholium.com.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — email address and authentication details you provide
          when signing up.
        </li>
        <li>
          <strong>Your content</strong> — flashcards, notes, poems, study progress, exam papers
          you upload to Mock Space, and similar data you create in the tools. This is stored
          privately to your account.
        </li>
        <li>
          <strong>Usage &amp; device data</strong> — basic logs, device/browser information, and
          interaction data needed to run and secure the Service. This includes privacy-respecting
          analytics: which features you use, when, and on which app. It is tied to your account when
          you are signed in, or to a random device identifier stored on your device when you are
          not. We do not record the content you create, and you can turn it off at any time in each
          app&rsquo;s Settings (see §8).
        </li>
      </ul>

      <h2>2. Why we use it (legal bases)</h2>
      <p>
        We process data to provide the Service and your account (performance of a contract), to
        keep it secure and prevent abuse (legitimate interests), and to comply with law. Where
        required, we rely on consent — including parental consent for younger users (see §7).
      </p>

      <h2>3. Who we share it with (processors)</h2>
      <p>We do not sell your personal data. We share it only with service providers who process it on our behalf:</p>
      <ul>
        <li><strong>Supabase</strong> — database, authentication, and storage.</li>
        <li><strong>Google Cloud (Text-to-Speech)</strong> — generating audio in Language Hub from the text you submit.</li>
        <li><strong>Vercel</strong> — hosting, content delivery, and privacy-friendly, cookieless traffic analytics (Vercel Web Analytics).</li>
      </ul>
      <p>
        We sign data-processing agreements with these providers. Some may process data outside
        your country; where they do, we rely on appropriate safeguards (e.g. Standard
        Contractual Clauses).
      </p>

      <h2>4. Fonts &amp; third-party requests</h2>
      <p>
        We self-host our fonts, so loading the Service does not send your IP address to
        third-party font providers.
      </p>

      <h2>5. Retention</h2>
      <p>
        We keep your data while your account is active. After you delete your account, we remove
        or anonymise personal data within a reasonable period, except where we must retain
        records to meet legal obligations. Mock Space is the exception: uploaded question papers
        and the associated attempt are deleted automatically 15 days after upload, regardless of
        account status.
      </p>

      <h2>6. Your rights</h2>
      <p>
        Depending on where you live (e.g. under the GDPR/UK GDPR or CCPA/CPRA), you may have the
        right to access, correct, delete, port, or restrict your data, to object to certain
        processing, and to withdraw consent. You can export or delete your content from within
        the Service, or contact admin@thescholium.com. You may also complain to your local
        data-protection authority.
      </p>

      <h2>7. Children’s privacy</h2>
      <p>
        Many of our users are minors. We do not knowingly collect data from a child below the
        age at which consent is required in their country without verifiable parental consent
        (for example, under COPPA in the US and Article 8 GDPR in the EU). If you believe a
        child has provided data without the required consent, contact us and we will delete it.
      </p>

      <h2>8. Cookies &amp; analytics</h2>
      <p>
        We use only the cookies and local storage needed to sign you in and remember your
        preferences (such as dark mode). Our product analytics are <strong>first-party</strong>:
        events are recorded against your account or a random device identifier held in your
        browser&rsquo;s local storage — there are no advertising cookies, no cross-site tracking, and
        no data sold or shared for advertising. Our traffic analytics (Vercel Web Analytics) are
        cookieless. You can turn product analytics off at any time from the toggle in each
        app&rsquo;s Settings; we also honour your browser&rsquo;s Global Privacy Control and
        Do-Not-Track signals.
      </p>

      <h2>9. Security</h2>
      <p>
        We use reasonable technical and organisational measures to protect your data, including
        access controls that scope your content to your account. No system is perfectly secure.
      </p>

      <h2>10. Grievances &amp; contact</h2>
      <p>
        Grievance Officer (India IT Rules, 2021): Vivek Agarwal,
        admin@thescholium.com. We acknowledge complaints within 24 hours and aim to
        resolve them within 15 days. General privacy contact: admin@thescholium.com.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may update this Policy; we will post the new version here and update the date above.
      </p>
    </LegalPage>
  );
}
