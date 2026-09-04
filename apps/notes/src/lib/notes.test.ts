import { describe, it, expect } from "vitest";
import { parseNoteFileName, compareNotes, type NoteFile } from "./notes";

describe("parseNoteFileName", () => {
  it("derives a title from a plain file name", () => {
    expect(parseNoteFileName("Kinematics reference.pdf")).toEqual({
      title: "Kinematics reference",
      order: null,
    });
  });

  it("reads a leading numeric prefix as the order and strips it", () => {
    expect(parseNoteFileName("3-Electricity-and-Magnetism.pdf")).toEqual({
      title: "Electricity and Magnetism",
      order: 3,
    });
  });

  it("accepts underscores and spaces as the prefix separator and word separator", () => {
    expect(parseNoteFileName("12_Organic_Chemistry.pdf")).toEqual({
      title: "Organic Chemistry",
      order: 12,
    });
    expect(parseNoteFileName("7 Waves and sound.pdf")).toEqual({
      title: "Waves and sound",
      order: 7,
    });
  });

  it("does not treat a number in the middle of the name as an order", () => {
    expect(parseNoteFileName("Paper 2 formulae.pdf")).toEqual({
      title: "Paper 2 formulae",
      order: null,
    });
  });

  it("is case-insensitive about the extension", () => {
    expect(parseNoteFileName("Notes.PDF")?.title).toBe("Notes");
  });

  it("rejects non-pdf names and empty stems", () => {
    expect(parseNoteFileName("thumbnail.png")).toBeNull();
    expect(parseNoteFileName(".pdf")).toBeNull();
    expect(parseNoteFileName("5-.pdf")).toBeNull();
  });
});

describe("compareNotes", () => {
  const make = (title: string, order: number | null): NoteFile => ({
    fileName: `${title}.pdf`,
    title,
    order,
  });

  it("orders numbered notes ascending, then unnumbered alphabetically", () => {
    const notes = [
      make("Zebra", null),
      make("Second", 2),
      make("Apple", null),
      make("First", 1),
      make("Tenth", 10),
    ];
    expect([...notes].sort(compareNotes).map((n) => n.title)).toEqual([
      "First",
      "Second",
      "Tenth",
      "Apple",
      "Zebra",
    ]);
  });

  it("breaks ties on equal order by title", () => {
    const notes = [make("Beta", 1), make("Alpha", 1)];
    expect([...notes].sort(compareNotes).map((n) => n.title)).toEqual(["Alpha", "Beta"]);
  });
});
