import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Chapter, Section, Subject } from "@/types";

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [chaptersRes, disabledRes] = await Promise.all([
        supabase
          .from("recall_chapters")
          .select("id, subject_id, subject_name, subject_emoji, section_id, section_name, name, sort_order, section_sort_order, subject_sort_order")
          .order("subject_sort_order", { ascending: true })
          .order("section_sort_order", { ascending: true })
          .order("sort_order", { ascending: true }),
        supabase
          .from("recall_disabled")
          .select("entity_id"),
      ]);

      if (cancelled) return;

      const disabledIds = new Set(
        (disabledRes.data ?? []).map((r: { entity_id: string }) => r.entity_id),
      );

      const rows = (chaptersRes.data ?? []) as {
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
      }[];

      // Filter disabled subjects/sections
      const visible = rows.filter(
        (r) => !disabledIds.has(r.subject_id) && !disabledIds.has(r.section_id),
      );

      // Build Subject[]
      const subjectMap = new Map<string, Subject>();
      const sectionMap = new Map<string, Section>();

      for (const row of visible) {
        // Subject
        let subject = subjectMap.get(row.subject_id);
        if (!subject) {
          subject = {
            id: row.subject_id,
            name: row.subject_name,
            emoji: row.subject_emoji,
            accent: "blue",
            sections: [],
          };
          subjectMap.set(row.subject_id, subject);
        }

        // Section
        const sectionKey = `${row.subject_id}::${row.section_id}`;
        let section = sectionMap.get(sectionKey);
        if (!section) {
          section = {
            id: row.section_id,
            name: row.section_name,
            chapters: [],
          };
          sectionMap.set(sectionKey, section);
          subject.sections.push(section);
        }

        // Chapter (no cards yet — loaded on demand in Study)
        const chapter: Chapter = {
          id: row.id,
          name: row.name,
          cards: [],
          cardCount: undefined,
        };
        section.chapters.push(chapter);
      }

      // Fetch card counts in one query
      const { data: counts } = await supabase
        .from("recall_cards")
        .select("chapter_id");

      if (!cancelled && counts) {
        const countMap: Record<string, number> = {};
        for (const { chapter_id } of counts as { chapter_id: string }[]) {
          countMap[chapter_id] = (countMap[chapter_id] ?? 0) + 1;
        }
        // Stamp cardCount onto every chapter
        for (const subject of subjectMap.values()) {
          for (const section of subject.sections) {
            for (const chapter of section.chapters) {
              chapter.cardCount = countMap[chapter.id] ?? 0;
            }
          }
        }
      }

      if (!cancelled) {
        setSubjects([...subjectMap.values()]);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { subjects, loading };
}
