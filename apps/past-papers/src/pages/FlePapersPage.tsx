import Layout from "@/components/Layout";
import manifest from "@/data/fleManifest.json";

// Static PDFs live in public/fle-papers/ and are listed in src/data/fleManifest.json
// (newest series first). Add a paper by dropping the PDFs in and adding it there.
const FILE_BASE = "/fle-papers/";

type Series = { slug: string; label: string; papers: { paper: string; qp: string | null; ms: string | null }[] };

function DownloadLink({ file, children }: { file: string | null; children: string }) {
  if (!file) {
    return <span className="text-sm text-muted-foreground">{children} unavailable</span>;
  }
  return (
    <a
      href={FILE_BASE + file}
      target="_blank"
      rel="noopener noreferrer"
      className="px-3 py-1.5 rounded-md border-2 border-border text-sm font-medium transition-all hover:border-primary hover:text-primary"
    >
      {children}
    </a>
  );
}

export default function FlePapersPage() {
  return (
    <Layout subtitle="First Language English (0500) past papers">
      <div
        role="note"
        className="rounded-lg border-2 border-amber-500/60 bg-amber-500/10 p-4 mb-8 text-sm"
      >
        <p className="font-display font-semibold mb-2">⚠️ Please read before downloading</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Inserts are not provided.</strong> Scholium does not host the inserts for these
            papers. You must source them from another past paper site.
          </li>
          <li>
            These question papers and mark schemes are <strong>unofficially adapted</strong> to the
            new exam format.
          </li>
        </ul>
      </div>

      <div className="space-y-8">
        {(manifest as Series[]).map((series) => (
          <section key={series.slug}>
            <h2 className="font-display font-semibold text-lg mb-3">{series.label}</h2>
            <ul className="space-y-2">
              {series.papers.map((p) => (
                <li
                  key={p.paper}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border-2 border-border"
                >
                  <span className="font-medium mr-auto">
                    Paper {p.paper}
                  </span>
                  <DownloadLink file={p.qp}>Question paper</DownloadLink>
                  <DownloadLink file={p.ms}>Mark scheme</DownloadLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Layout>
  );
}
