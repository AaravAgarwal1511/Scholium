import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import ChapterEditor from "./ChapterEditor";

type Chapter = {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_emoji: string;
  section_id: string;
  section_name: string;
  name: string;
  sort_order: number;
  section_sort_order: number;
  subject_sort_order: number;
};

type DisabledSet = Set<string>; // entity_id values that are disabled

export default function Content() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [disabled, setDisabled] = useState<DisabledSet>(new Set());
  const [err, setErr] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [openChapterId, setOpenChapterId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState<string | null>(null); // null = not creating
  const [creatingSubject, setCreatingSubject] = useState(false);
  // When creating a chapter in a brand-new section (or brand-new subject), we pass this as
  // `defaults` instead of looking up the section from existing chapters.
  const [pendingSectionCtx, setPendingSectionCtx] = useState<{
    subject_id: string; subject_name: string; subject_emoji: string;
    section_id: string; section_name: string;
  } | null>(null);

  async function load() {
    const [chaptersRes, disabledRes] = await Promise.all([
      supabase.from("recall_chapters").select("*").order("sort_order", { ascending: true }),
      supabase.from("recall_disabled").select("entity_id"),
    ]);
    if (chaptersRes.error) setErr(chaptersRes.error.message);
    else setChapters((chaptersRes.data as Chapter[]) ?? []);
    if (!disabledRes.error)
      setDisabled(new Set((disabledRes.data ?? []).map((r) => r.entity_id)));
  }

  useEffect(() => { load(); }, []);

  async function swapSubjects(idA: string, idB: string) {
    setChapters((prev) => {
      const ordA = prev.find((c) => c.subject_id === idA)?.subject_sort_order ?? 0;
      const ordB = prev.find((c) => c.subject_id === idB)?.subject_sort_order ?? 0;
      return prev.map((c) =>
        c.subject_id === idA ? { ...c, subject_sort_order: ordB }
        : c.subject_id === idB ? { ...c, subject_sort_order: ordA }
        : c,
      );
    });
    await supabase.rpc("admin_swap_subject_order", { p_subject_id_a: idA, p_subject_id_b: idB });
  }

  async function swapSections(idA: string, idB: string) {
    // Optimistic: update section_sort_order in local chapters state
    setChapters((prev) => {
      const ordA = prev.find((c) => c.section_id === idA)?.section_sort_order ?? 0;
      const ordB = prev.find((c) => c.section_id === idB)?.section_sort_order ?? 0;
      return prev.map((c) =>
        c.section_id === idA ? { ...c, section_sort_order: ordB }
        : c.section_id === idB ? { ...c, section_sort_order: ordA }
        : c,
      );
    });
    await supabase.rpc("admin_swap_section_order", { p_section_id_a: idA, p_section_id_b: idB });
  }

  async function swapChapters(idA: string, idB: string) {
    setChapters((prev) => {
      const ordA = prev.find((c) => c.id === idA)?.sort_order ?? 0;
      const ordB = prev.find((c) => c.id === idB)?.sort_order ?? 0;
      return prev.map((c) =>
        c.id === idA ? { ...c, sort_order: ordB }
        : c.id === idB ? { ...c, sort_order: ordA }
        : c,
      );
    });
    await supabase.rpc("admin_swap_chapter_order", { p_id_a: idA, p_id_b: idB });
  }

  async function toggleDisabled(entityId: string, entityType: "subject" | "section") {
    const nowDisabled = !disabled.has(entityId);
    // Optimistic update
    setDisabled((prev) => {
      const next = new Set(prev);
      if (nowDisabled) next.add(entityId);
      else next.delete(entityId);
      return next;
    });
    const { error } = await supabase.rpc("admin_set_disabled", {
      p_disabled: nowDisabled,
      p_entity_id: entityId,
      p_entity_type: entityType,
    });
    if (error) {
      // Roll back
      setDisabled((prev) => {
        const next = new Set(prev);
        if (nowDisabled) next.delete(entityId);
        else next.add(entityId);
        return next;
      });
      setErr(error.message);
    }
  }

  const subjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; emoji: string; count: number; subject_sort_order: number }>();
    for (const c of chapters) {
      const prev = map.get(c.subject_id);
      if (prev) prev.count += 1;
      else map.set(c.subject_id, {
        id: c.subject_id,
        name: c.subject_name,
        emoji: c.subject_emoji,
        count: 1,
        subject_sort_order: c.subject_sort_order,
      });
    }
    return [...map.values()].sort((a, b) => a.subject_sort_order - b.subject_sort_order);
  }, [chapters]);

  const sections = useMemo(() => {
    if (!subjectId) return [];
    const map = new Map<string, { id: string; name: string; count: number; section_sort_order: number }>();
    for (const c of chapters) {
      if (c.subject_id !== subjectId) continue;
      const prev = map.get(c.section_id);
      if (prev) prev.count += 1;
      else map.set(c.section_id, { id: c.section_id, name: c.section_name, count: 1, section_sort_order: c.section_sort_order });
    }
    return [...map.values()].sort((a, b) => a.section_sort_order - b.section_sort_order);
  }, [chapters, subjectId]);

  const visibleChapters = useMemo(
    () =>
      chapters
        .filter((c) => c.subject_id === subjectId && c.section_id === sectionId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [chapters, subjectId, sectionId],
  );

  if (err) return <div className="p-10 text-red-600">{err}</div>;

  if (openChapterId) {
    const existing = chapters.find((c) => c.id === openChapterId);
    return (
      <ChapterEditor
        chapterId={openChapterId}
        existing={existing ?? null}
        defaults={
          existing
            ? undefined
            : pendingSectionCtx ?? subjectContext(chapters, subjectId, sectionId)
        }
        allChapters={chapters}
        onBack={() => {
          setOpenChapterId(null);
          setPendingSectionCtx(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
        <Crumb onClick={() => { setSubjectId(null); setSectionId(null); }} active={!subjectId}>
          All subjects
        </Crumb>
        {subjectId && (
          <>
            <span>/</span>
            <Crumb onClick={() => setSectionId(null)} active={!sectionId}>
              {subjects.find((s) => s.id === subjectId)?.name}
            </Crumb>
          </>
        )}
        {sectionId && (
          <>
            <span>/</span>
            <span className="text-slate-900 font-medium">
              {sections.find((s) => s.id === sectionId)?.name}
            </span>
          </>
        )}
      </div>

      {!subjectId && (
        <>
          <Grid>
            {subjects.map((s, i) => (
              <SubjectCard
                key={s.id}
                subject={s}
                isDisabled={disabled.has(s.id)}
                onOpen={() => setSubjectId(s.id)}
                onSaved={load}
                onToggleDisabled={() => toggleDisabled(s.id, "subject")}
                onMoveUp={i > 0 ? () => swapSubjects(s.id, subjects[i - 1].id) : undefined}
                onMoveDown={i < subjects.length - 1 ? () => swapSubjects(s.id, subjects[i + 1].id) : undefined}
              />
            ))}
          </Grid>
          {!creatingSubject ? (
            <button
              onClick={() => setCreatingSubject(true)}
              className="mt-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 py-5 w-full hover:border-slate-400 hover:text-slate-700"
            >
              + New subject
            </button>
          ) : (
            <NewSubjectForm
              existingSubjectIds={new Set(subjects.map((s) => s.id))}
              onConfirm={({ subjectId, subjectName, subjectEmoji, sectionName }) => {
                const sectionId = slugify(`${subjectId}-${sectionName}`);
                setPendingSectionCtx({
                  subject_id: subjectId,
                  subject_name: subjectName,
                  subject_emoji: subjectEmoji,
                  section_id: sectionId,
                  section_name: sectionName,
                });
                setCreatingSubject(false);
                setOpenChapterId(`new:${crypto.randomUUID()}`);
              }}
              onCancel={() => setCreatingSubject(false)}
            />
          )}
        </>
      )}

      {subjectId && !sectionId && (
        <>
          <Grid>
            {sections.map((s, i) => (
              <SectionCard
                key={s.id}
                section={s}
                isDisabled={disabled.has(s.id)}
                onOpen={() => setSectionId(s.id)}
                onSaved={load}
                onToggleDisabled={() => toggleDisabled(s.id, "section")}
                onMoveUp={i > 0 ? () => swapSections(s.id, sections[i - 1].id) : undefined}
                onMoveDown={i < sections.length - 1 ? () => swapSections(s.id, sections[i + 1].id) : undefined}
              />
            ))}
          </Grid>
          {newSectionName === null ? (
            <button
              onClick={() => setNewSectionName("")}
              className="mt-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 py-5 w-full hover:border-slate-400 hover:text-slate-700"
            >
              + New section
            </button>
          ) : (
            <NewSectionForm
              onConfirm={(name) => {
                const subject = subjects.find((s) => s.id === subjectId)!;
                const sectionId = slugify(`${subjectId}-${name}`);
                const ctx = {
                  subject_id: subjectId,
                  subject_name: subject.name,
                  subject_emoji: subject.emoji,
                  section_id: sectionId,
                  section_name: name,
                };
                setPendingSectionCtx(ctx);
                setNewSectionName(null);
                setOpenChapterId(`new:${crypto.randomUUID()}`);
              }}
              onCancel={() => setNewSectionName(null)}
            />
          )}
        </>
      )}

      {subjectId && sectionId && (
        <div className="flex flex-col gap-2">
          {visibleChapters.map((c, i) => (
            <div key={c.id} className="bg-white rounded-xl shadow px-5 py-4 flex items-center gap-3">
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => swapChapters(c.id, visibleChapters[i - 1].id)}
                  disabled={i === 0}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none"
                  aria-label="Move up"
                >▲</button>
                <button
                  onClick={() => swapChapters(c.id, visibleChapters[i + 1].id)}
                  disabled={i === visibleChapters.length - 1}
                  className="text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none"
                  aria-label="Move down"
                >▼</button>
              </div>
              <button
                onClick={() => setOpenChapterId(c.id)}
                className="flex-1 text-left min-w-0"
              >
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-xs text-slate-500">{c.id}</div>
              </button>
              <span className="text-slate-400 text-sm flex-shrink-0">Edit →</span>
            </div>
          ))}
          <button
            onClick={() => setOpenChapterId(`new:${crypto.randomUUID()}`)}
            className="rounded-xl border-2 border-dashed border-slate-300 text-slate-500 py-5 hover:border-slate-400 hover:text-slate-700"
          >
            + New chapter
          </button>
        </div>
      )}
    </div>
  );
}

function subjectContext(chapters: Chapter[], subjectId: string | null, sectionId: string | null) {
  if (!subjectId || !sectionId) return undefined;
  const sample = chapters.find((c) => c.subject_id === subjectId && c.section_id === sectionId);
  if (!sample) return undefined;
  return {
    subject_id: sample.subject_id,
    subject_name: sample.subject_name,
    subject_emoji: sample.subject_emoji,
    section_id: sample.section_id,
    section_name: sample.section_name,
  };
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{children}</div>;
}

function DisableToggle({ isDisabled, onToggle }: { isDisabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title={isDisabled ? "Enable" : "Disable"}
      className={
        "w-8 h-5 rounded-full transition-colors flex-shrink-0 " +
        (isDisabled ? "bg-slate-300" : "bg-emerald-500")
      }
    >
      <span
        className={
          "block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 " +
          (isDisabled ? "translate-x-0" : "translate-x-3")
        }
      />
    </button>
  );
}

function SubjectCard({
  subject,
  isDisabled,
  onOpen,
  onSaved,
  onToggleDisabled,
  onMoveUp,
  onMoveDown,
}: {
  subject: { id: string; name: string; emoji: string; count: number };
  isDisabled: boolean;
  onOpen: () => void;
  onSaved: () => void;
  onToggleDisabled: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [emoji, setEmoji] = useState(subject.emoji);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("admin_rename_subject", {
      p_new_emoji: emoji.trim(),
      p_new_name: name.trim(),
      p_subject_id: subject.id,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else { setEditing(false); onSaved(); }
  }

  if (editing) {
    return (
      <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-2">
        <div className="flex gap-2">
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="border rounded-lg px-2 py-1 w-14 text-center" />
          <input value={name} onChange={(e) => setName(e.target.value)} className="border rounded-lg px-3 py-1 flex-1" />
        </div>
        {err && <div className="text-red-600 text-xs">{err}</div>}
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="text-xs text-slate-600 px-2 py-1">Cancel</button>
          <button onClick={save} disabled={busy} className="text-xs bg-slate-900 text-white px-3 py-1 rounded-md disabled:opacity-50">
            {busy ? "…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={
      "rounded-xl shadow hover:shadow-md transition-shadow flex items-stretch overflow-hidden " +
      (isDisabled ? "bg-slate-100 opacity-60" : "bg-white")
    }>
      <div className="flex flex-col justify-center gap-0.5 px-2 border-r border-slate-100 flex-shrink-0">
        <button onClick={onMoveUp} disabled={!onMoveUp} className="text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none px-1" aria-label="Move up">▲</button>
        <button onClick={onMoveDown} disabled={!onMoveDown} className="text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none px-1" aria-label="Move down">▼</button>
      </div>
      <button onClick={onOpen} className="flex-1 p-4 text-left min-w-0">
        <div className="font-semibold truncate">
          {subject.emoji} {subject.name}
        </div>
        <div className="text-xs text-slate-500 mt-1">{subject.count} chapters</div>
        {isDisabled && <div className="text-xs text-amber-600 font-medium mt-1">Disabled</div>}
      </button>
      <div className="flex items-center gap-2 pr-3 flex-shrink-0">
        <DisableToggle isDisabled={isDisabled} onToggle={onToggleDisabled} />
        <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:text-slate-900">Rename</button>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  isDisabled,
  onOpen,
  onSaved,
  onToggleDisabled,
  onMoveUp,
  onMoveDown,
}: {
  section: { id: string; name: string; count: number; section_sort_order: number };
  isDisabled: boolean;
  onOpen: () => void;
  onSaved: () => void;
  onToggleDisabled: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("admin_rename_section", {
      p_section_id: section.id,
      p_new_name: name.trim(),
    });
    setBusy(false);
    if (error) setErr(error.message);
    else { setEditing(false); onSaved(); }
  }

  if (editing) {
    return (
      <div className="bg-white rounded-xl shadow p-5 flex flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="border rounded-lg px-3 py-1" />
        {err && <div className="text-red-600 text-xs">{err}</div>}
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="text-xs text-slate-600 px-2 py-1">Cancel</button>
          <button onClick={save} disabled={busy} className="text-xs bg-slate-900 text-white px-3 py-1 rounded-md disabled:opacity-50">
            {busy ? "…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={
      "rounded-xl shadow hover:shadow-md transition-shadow flex items-stretch overflow-hidden " +
      (isDisabled ? "bg-slate-100 opacity-60" : "bg-white")
    }>
      <div className="flex flex-col justify-center gap-0.5 px-2 border-r border-slate-100 flex-shrink-0">
        <button onClick={onMoveUp} disabled={!onMoveUp} className="text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none px-1">▲</button>
        <button onClick={onMoveDown} disabled={!onMoveDown} className="text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none px-1">▼</button>
      </div>
      <button onClick={onOpen} className="flex-1 p-4 text-left min-w-0">
        <div className="font-semibold truncate">{section.name}</div>
        <div className="text-xs text-slate-500 mt-1">{section.count} chapters</div>
        {isDisabled && <div className="text-xs text-amber-600 font-medium mt-1">Disabled</div>}
      </button>
      <div className="flex items-center gap-2 pr-3 flex-shrink-0">
        <DisableToggle isDisabled={isDisabled} onToggle={onToggleDisabled} />
        <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:text-slate-900">Rename</button>
      </div>
    </div>
  );
}

function NewSectionForm({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="mt-4 bg-white rounded-xl shadow p-5 flex flex-col gap-3">
      <div className="text-sm font-semibold text-slate-700">New section</div>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder="e.g. Thermodynamics"
        className="border rounded-lg px-3 py-2 w-full"
      />
      <p className="text-xs text-slate-500">
        You'll add the first chapter on the next screen.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-sm text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          disabled={!name.trim()}
          onClick={() => onConfirm(name.trim())}
          className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-40"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function NewSubjectForm({
  existingSubjectIds,
  onConfirm,
  onCancel,
}: {
  existingSubjectIds: Set<string>;
  onConfirm: (v: {
    subjectId: string;
    subjectName: string;
    subjectEmoji: string;
    sectionName: string;
  }) => void;
  onCancel: () => void;
}) {
  const [emoji, setEmoji] = useState("");
  const [name, setName] = useState("");
  const [sectionName, setSectionName] = useState("");

  const trimmedName = name.trim();
  const trimmedEmoji = emoji.trim();
  const trimmedSection = sectionName.trim();
  const idCandidate = trimmedName ? uniqueSubjectId(trimmedName, existingSubjectIds) : "";
  const ready =
    trimmedName.length > 0 && trimmedEmoji.length > 0 && trimmedSection.length > 0;

  function submit() {
    if (!ready) return;
    onConfirm({
      subjectId: idCandidate,
      subjectName: trimmedName,
      subjectEmoji: trimmedEmoji,
      sectionName: trimmedSection,
    });
  }

  return (
    <div className="mt-4 bg-white rounded-xl shadow p-5 flex flex-col gap-3">
      <div className="text-sm font-semibold text-slate-700">New subject</div>
      <div className="flex gap-2">
        <input
          autoFocus
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="📘"
          className="border rounded-lg px-2 py-2 w-16 text-center"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Subject name (e.g. Biology)"
          className="border rounded-lg px-3 py-2 flex-1"
        />
      </div>
      <input
        value={sectionName}
        onChange={(e) => setSectionName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && ready) submit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="First section name (e.g. Cell Biology)"
        className="border rounded-lg px-3 py-2 w-full"
      />
      {idCandidate && (
        <p className="text-xs text-slate-500">
          subject id: <code>{idCandidate}</code>
        </p>
      )}
      <p className="text-xs text-slate-500">
        You'll add the first chapter on the next screen.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-sm text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          disabled={!ready}
          onClick={submit}
          className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-40"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function uniqueSubjectId(name: string, existing: Set<string>) {
  const base = slugify(name);
  if (!base) return "";
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function Crumb({ onClick, active, children }: { onClick: () => void; active: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={active ? "text-slate-900 font-medium" : "hover:text-slate-700"}>
      {children}
    </button>
  );
}
