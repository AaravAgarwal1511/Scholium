import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Download, FileText, Loader2, ScrollText } from "lucide-react";
import Layout from "@/components/Layout";
import Crumbs from "@/components/Crumbs";
import { ErrorState, EmptyState } from "@/components/StateViews";
import { useAsync } from "@/hooks/useAsync";
import {
  getChapterYears,
  listChapters,
  paperNumOf,
  requestChapterPaper,
  subjectDisplayName,
  type ChapterEntry,
  type PaperFile,
  type PaperOrder,
} from "@/lib/papers";

type Kind = "qp" | "ms";

const KIND_LABEL: Record<Kind, string> = {
  qp: "Question paper",
  ms: "Mark scheme",
};

function kindStyle(kind: Kind) {
  const accentVar = kind === "qp" ? "--primary" : "--accent";
  return {
    color: `hsl(var(${accentVar}))`,
    background: `hsl(var(${accentVar}) / 0.08)`,
    borderColor: `hsl(var(${accentVar}) / 0.2)`,
  };
}

// One row in the chapter card. Renders as a link when a prebuilt PDF already
// matches the current selection, and as a button when it has to be composed.
function PaperAction({
  kind,
  href,
  onClick,
  busy,
  unavailable,
}: {
  kind: Kind;
  href?: string;
  onClick?: () => void;
  busy?: boolean;
  unavailable?: string;
}) {
  const label = KIND_LABEL[kind];
  const Icon = kind === "qp" ? FileText : ScrollText;
  const { color, background, borderColor } = kindStyle(kind);

  if (unavailable || (!href && !onClick)) {
    const text = unavailable ?? `${label} not available`;
    return (
      <div
        className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
        aria-label={`${label}: ${text}`}
      >
        <Icon size={16} className="opacity-50" />
        <span>{text}</span>
      </div>
    );
  }

  const className =
    "group flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-60 disabled:cursor-wait";
  const style = { background, borderColor, color };

  const inner = (
    <>
      <Icon size={16} />
      <span className="flex-1 text-left">{busy ? "Preparing…" : label}</span>
      {busy ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Download size={14} className="opacity-60 group-hover:opacity-100 transition-opacity" />
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={busy} className={className} style={style}>
      {inner}
    </button>
  );
}

function ChapterCard({
  entry,
  subject,
  paperNum,
  years,
  yearFrom,
  yearTo,
  order,
}: {
  entry: ChapterEntry;
  subject: string;
  paperNum: number;
  years: number[] | undefined;
  yearFrom: number;
  yearTo: number;
  order: PaperOrder;
}) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A stale failure shouldn't outlive the selection that caused it.
  useEffect(() => setError(null), [yearFrom, yearTo, order]);

  const hasYears = !!years?.length;
  const yearsInRange = years?.filter((y) => y >= yearFrom && y <= yearTo) ?? [];

  // The prebuilt topical PDF holds every year this chapter has, oldest exam
  // first. A range that spans all of them asks for exactly that file, even if
  // it's wider than the chapter (e.g. 2014–2025 over a chapter that starts in
  // 2016) — so there's nothing to compose. Until the year index loads there is
  // nothing to narrow either, and the card behaves as it always did.
  const coversEveryYear = hasYears && yearsInRange.length === years!.length;
  const usePrebuilt = !hasYears || (coversEveryYear && order === "oldest");

  const fileFor = (kind: Kind): PaperFile | null =>
    kind === "qp" ? entry.questionPaper : entry.markScheme;

  const handleCompose = async (kind: Kind) => {
    // Open the tab synchronously inside the click handler — doing it after the
    // await would trip the popup blocker.
    const tab = window.open("", "_blank");
    setBusy(kind);
    setError(null);
    try {
      const url = await requestChapterPaper({
        subject,
        paperNum,
        chapter: entry.number,
        yearFrom,
        yearTo,
        order,
        kind,
      });
      if (tab && !tab.closed) {
        tab.opener = null;
        tab.location.replace(url);
      } else {
        window.location.assign(url);
      }
    } catch (err) {
      tab?.close();
      setError(err instanceof Error ? err.message : `Could not build the ${KIND_LABEL[kind]}`);
    } finally {
      setBusy(null);
    }
  };

  const actionProps = (kind: Kind) => {
    const file = fileFor(kind);
    if (usePrebuilt && file) return { href: file.url };
    if (!hasYears) return {};
    // Say so up front rather than letting the request come back empty.
    if (yearsInRange.length === 0) return { unavailable: `Nothing from ${yearFrom}–${yearTo}` };
    // A missing prebuilt file is fine as long as the chapter has indexed
    // questions — compose it instead of showing "not available".
    return { onClick: () => handleCompose(kind), busy: busy === kind };
  };

  return (
    <article
      className="rounded-2xl border border-border bg-card p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-baseline gap-3 mb-4">
        <span
          className="font-display font-bold text-sm w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "hsl(var(--primary) / 0.1)",
            color: "hsl(var(--primary))",
          }}
        >
          {entry.number}
        </span>
        <h3 className="font-display font-bold text-lg text-foreground leading-tight">
          {entry.name}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <PaperAction kind="qp" {...actionProps("qp")} />
        <PaperAction kind="ms" {...actionProps("ms")} />
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5">
          <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </article>
  );
}

const selectClass =
  "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:border-primary";

function SelectionBar({
  years,
  yearFrom,
  yearTo,
  order,
  isDefault,
  onFrom,
  onTo,
  onOrder,
}: {
  years: number[];
  yearFrom: number;
  yearTo: number;
  order: PaperOrder;
  isDefault: boolean;
  onFrom: (y: number) => void;
  onTo: (y: number) => void;
  onOrder: (o: PaperOrder) => void;
}) {
  return (
    <section
      className="mb-6 rounded-2xl border border-border bg-card p-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor="year-from">
          Years
        </label>
        <select
          id="year-from"
          className={selectClass}
          value={yearFrom}
          onChange={(e) => onFrom(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">to</span>
        <select
          className={selectClass}
          value={yearTo}
          aria-label="Latest year"
          onChange={(e) => onTo(Number(e.target.value))}
        >
          {years
            .filter((y) => y >= yearFrom)
            .map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm font-medium text-foreground" htmlFor="paper-order">
            Order
          </label>
          <select
            id="paper-order"
            className={selectClass}
            value={order}
            onChange={(e) => onOrder(e.target.value as PaperOrder)}
          >
            <option value="oldest">Oldest first</option>
            <option value="newest">Latest first</option>
          </select>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {isDefault
          ? "Applies to every chapter below. This is the full compilation — downloads start instantly."
          : "Applies to every chapter below. Chapters are rebuilt to match, so the first download of a new selection takes a few seconds."}
      </p>
    </section>
  );
}

export default function ChaptersPage() {
  const { subject = "", component = "" } = useParams();
  const subjectName = decodeURIComponent(subject);
  const componentName = decodeURIComponent(component);
  const paperNum = paperNumOf(componentName);

  const { data, loading, error } = useAsync(
    () => listChapters(subjectName, componentName),
    [subjectName, componentName]
  );

  // Which years each chapter can offer. If this fails the cards fall back to the
  // prebuilt links, so its error is deliberately not surfaced.
  const { data: yearIndex } = useAsync(
    () => getChapterYears(subjectName, paperNum),
    [subjectName, paperNum]
  );

  // Every year the component has, across all its chapters.
  const allYears = useMemo(() => {
    if (!yearIndex) return [];
    const seen = new Set<number>();
    for (const years of yearIndex.values()) for (const y of years) seen.add(y);
    return Array.from(seen).sort((a, b) => a - b);
  }, [yearIndex]);

  // `allYears` arrives a tick after the first render, so the range defaults to
  // "everything" lazily rather than being captured as initial state.
  const [pickedFrom, setPickedFrom] = useState<number | null>(null);
  const [pickedTo, setPickedTo] = useState<number | null>(null);
  const [order, setOrder] = useState<PaperOrder>("oldest");

  // Navigating to another paper brings a different set of years with it.
  useEffect(() => {
    setPickedFrom(null);
    setPickedTo(null);
    setOrder("oldest");
  }, [subjectName, componentName]);

  const minYear = allYears[0] ?? 0;
  const maxYear = allYears[allYears.length - 1] ?? 0;
  const yearFrom = pickedFrom ?? minYear;
  const yearTo = pickedTo ?? maxYear;
  const isDefault = yearFrom === minYear && yearTo === maxYear && order === "oldest";

  const handleFrom = (next: number) => {
    setPickedFrom(next);
    if (next > yearTo) setPickedTo(next);
  };

  return (
    <Layout subtitle="Each chapter has a paper compilation and its mark scheme.">
      <div className="mb-4">
        <Crumbs
          items={[
            { label: "Subjects", to: "/" },
            { label: subjectDisplayName(subjectName), to: `/${encodeURIComponent(subjectName)}` },
            { label: componentName },
          ]}
        />
      </div>

      <div className="mb-6">
        <h2 className="font-display font-bold text-2xl text-foreground">
          {componentName}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{subjectDisplayName(subjectName)}</p>
      </div>

      {allYears.length > 0 && (
        <SelectionBar
          years={allYears}
          yearFrom={yearFrom}
          yearTo={yearTo}
          order={order}
          isDefault={isDefault}
          onFrom={handleFrom}
          onTo={setPickedTo}
          onOrder={setOrder}
        />
      )}

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-2xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      )}
      {error && <ErrorState error={error} />}
      {!loading && !error && data && data.length === 0 && (
        <EmptyState
          title="No chapters yet"
          hint={`Upload PDFs named like "3-Algebra-QP.pdf" and "3-Algebra-MS.pdf" into "${subjectName}/${componentName}".`}
        />
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.map((entry) => (
            <ChapterCard
              key={entry.number}
              entry={entry}
              subject={subjectName}
              paperNum={paperNum}
              years={yearIndex?.get(entry.number)}
              yearFrom={yearFrom}
              yearTo={yearTo}
              order={order}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}
