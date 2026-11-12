-- ── Split the Chemistry definitions into topic chapters ─────────────────────────
-- 20261111000000 added all 55 IGCSE Chemistry 0620 definitions as one chapter,
-- 'Syllabus Definitions' (chemistry-definitions). Fifty-five cards in one study
-- set is daunting, so this breaks them into eight topic chapters of 5-9 cards
-- under the same 'Definitions' section, then removes the now-empty old chapter.
--
-- A new migration rather than an edit of 20261111000000, which is already merged
-- and may already be applied to production. Written to be correct either way:
-- it moves the existing cards (UPDATE, so card ids are preserved) and is a no-op
-- on re-run.
--
-- Chapter sort_order 8..15 replaces the single chapter's 8 (the first eight
-- chapters, 0..7, are Reference Tables). Deleting the old chapter cascades to
-- recall_progress rows for it — at most the pass level on a chapter that no
-- longer exists, which has no equivalent among the new ones.

INSERT INTO public.recall_chapters
  (id, subject_id, subject_name, subject_emoji, section_id, section_name, name, sort_order, section_sort_order, subject_sort_order)
VALUES
  ('chemistry-definitions-atoms-bonding', 'chemistry', 'Chemistry', '🧪', 'chemistry-definitions-section', 'Definitions', 'Atoms & Bonding', 8, 1, 2),
  ('chemistry-definitions-formulae-mole', 'chemistry', 'Chemistry', '🧪', 'chemistry-definitions-section', 'Definitions', 'Formulae & the Mole', 9, 1, 2),
  ('chemistry-definitions-electrolysis-energy', 'chemistry', 'Chemistry', '🧪', 'chemistry-definitions-section', 'Definitions', 'Electrolysis & Energy Changes', 10, 1, 2),
  ('chemistry-definitions-rates-equilibrium-redox', 'chemistry', 'Chemistry', '🧪', 'chemistry-definitions-section', 'Definitions', 'Rates, Equilibrium & Redox', 11, 1, 2),
  ('chemistry-definitions-acids-salts-alloys', 'chemistry', 'Chemistry', '🧪', 'chemistry-definitions-section', 'Definitions', 'Acids, Bases, Salts & Alloys', 12, 1, 2),
  ('chemistry-definitions-organic-formulae', 'chemistry', 'Chemistry', '🧪', 'chemistry-definitions-section', 'Definitions', 'Organic Formulae & Series', 13, 1, 2),
  ('chemistry-definitions-organic-reactions', 'chemistry', 'Chemistry', '🧪', 'chemistry-definitions-section', 'Definitions', 'Organic Bonding & Reactions', 14, 1, 2),
  ('chemistry-definitions-solutions-separation', 'chemistry', 'Chemistry', '🧪', 'chemistry-definitions-section', 'Definitions', 'Solutions & Separation', 15, 1, 2)
ON CONFLICT (id) DO NOTHING;

UPDATE public.recall_cards AS c
   SET chapter_id = m.new_chapter_id,
       sort_order = m.new_sort_order
  FROM (VALUES
  ('chemistry-definitions-atoms-bonding','Proton number / atomic number',0),
  ('chemistry-definitions-atoms-bonding','Mass number / nucleon number',1),
  ('chemistry-definitions-atoms-bonding','Isotopes',2),
  ('chemistry-definitions-atoms-bonding','Cation and anion',3),
  ('chemistry-definitions-atoms-bonding','Ionic bond',4),
  ('chemistry-definitions-atoms-bonding','Giant ionic lattice',5),
  ('chemistry-definitions-atoms-bonding','Covalent bond',6),
  ('chemistry-definitions-atoms-bonding','Metallic bonding',7),
  ('chemistry-definitions-formulae-mole','Molecular formula',0),
  ('chemistry-definitions-formulae-mole','Empirical formula',1),
  ('chemistry-definitions-formulae-mole','Relative atomic mass, Ar',2),
  ('chemistry-definitions-formulae-mole','Relative molecular mass, Mr',3),
  ('chemistry-definitions-formulae-mole','Mole and Avogadro constant',4),
  ('chemistry-definitions-electrolysis-energy','Electrolysis',0),
  ('chemistry-definitions-electrolysis-energy','Anode, cathode, electrolyte',1),
  ('chemistry-definitions-electrolysis-energy','Hydrogen–oxygen fuel cell',2),
  ('chemistry-definitions-electrolysis-energy','Exothermic reaction',3),
  ('chemistry-definitions-electrolysis-energy','Endothermic reaction',4),
  ('chemistry-definitions-electrolysis-energy','Enthalpy change, ΔH',5),
  ('chemistry-definitions-electrolysis-energy','Activation energy, Ea',6),
  ('chemistry-definitions-electrolysis-energy','Bond breaking and bond making',7),
  ('chemistry-definitions-rates-equilibrium-redox','Catalyst',0),
  ('chemistry-definitions-rates-equilibrium-redox','Catalyst (activation energy)',1),
  ('chemistry-definitions-rates-equilibrium-redox','Equilibrium',2),
  ('chemistry-definitions-rates-equilibrium-redox','Redox reactions',3),
  ('chemistry-definitions-rates-equilibrium-redox','Oxidation and reduction (oxygen)',4),
  ('chemistry-definitions-rates-equilibrium-redox','Oxidation (electrons / oxidation number)',5),
  ('chemistry-definitions-rates-equilibrium-redox','Reduction (electrons / oxidation number)',6),
  ('chemistry-definitions-rates-equilibrium-redox','Oxidising agent',7),
  ('chemistry-definitions-rates-equilibrium-redox','Reducing agent',8),
  ('chemistry-definitions-acids-salts-alloys','Bases and alkalis',0),
  ('chemistry-definitions-acids-salts-alloys','Acids and bases (proton definition)',1),
  ('chemistry-definitions-acids-salts-alloys','Strong acid and weak acid',2),
  ('chemistry-definitions-acids-salts-alloys','Amphoteric oxides',3),
  ('chemistry-definitions-acids-salts-alloys','Hydrated and anhydrous substance',4),
  ('chemistry-definitions-acids-salts-alloys','Water of crystallisation',5),
  ('chemistry-definitions-acids-salts-alloys','Alloy',6),
  ('chemistry-definitions-organic-formulae','Displayed formula',0),
  ('chemistry-definitions-organic-formulae','Structural formula',1),
  ('chemistry-definitions-organic-formulae','Structural isomers',2),
  ('chemistry-definitions-organic-formulae','Functional group',3),
  ('chemistry-definitions-organic-formulae','Homologous series',4),
  ('chemistry-definitions-organic-formulae','Hydrocarbons',5),
  ('chemistry-definitions-organic-reactions','Saturated compound',0),
  ('chemistry-definitions-organic-reactions','Unsaturated compound',1),
  ('chemistry-definitions-organic-reactions','Substitution reaction',2),
  ('chemistry-definitions-organic-reactions','Addition reaction',3),
  ('chemistry-definitions-organic-reactions','Polymers',4),
  ('chemistry-definitions-solutions-separation','Solvent',0),
  ('chemistry-definitions-solutions-separation','Solute',1),
  ('chemistry-definitions-solutions-separation','Solution',2),
  ('chemistry-definitions-solutions-separation','Saturated solution',3),
  ('chemistry-definitions-solutions-separation','Residue',4),
  ('chemistry-definitions-solutions-separation','Filtrate',5),
  ('chemistry-definitions-solutions-separation','Rf value',6)
  ) AS m(new_chapter_id, term, new_sort_order)
 WHERE c.chapter_id = 'chemistry-definitions'
   AND c.term = m.term;

-- Only remove the old chapter once it is empty, so a card that failed to map is
-- never cascade-deleted along with it.
DELETE FROM public.recall_chapters r
 WHERE r.id = 'chemistry-definitions'
   AND NOT EXISTS (SELECT 1 FROM public.recall_cards c WHERE c.chapter_id = r.id);
