-- ── Chemistry subject for Recall Master ─────────────────────────────────────────
-- Adds a third recall_chapters subject ('chemistry', 🧪, subject_sort_order 2,
-- after economics=0 and physics=1 — see 20260526010000's admin_save_chapter,
-- which would compute the same MAX+1 value for any chapter added by hand later)
-- alongside the existing Physics/Economics content seeded by 20260421000000.
--
-- Source: eight IGCSE-style reference tables (flame tests, cation/anion tests,
-- gas tests, ion valencies, industrial catalysts, hydrated salts, the
-- reactivity series). No schema change — recall_chapters/recall_cards already
-- exist with public SELECT policies + grants (20260421000000,
-- 20260822010000), so this is a pure content migration.
--
-- Kept as one flat section ('Reference Tables') rather than several syllabus
-- sub-topics: every chapter here is a standalone reference table, not a body
-- of connected concepts, so splitting into thin one-chapter sections would add
-- nothing.
--
-- Corrections made to the source material (each is a genuine chemistry error,
-- not a style choice):
--   • Mg + 2H2O → MgO + H2 was unbalanced (4 H on the left, 2 on the right).
--     Corrected to Mg + H2O → MgO + H2, which balances (magnesium reacts with
--     steam, not cold water, and only needs one water molecule).
--   • "Vanadium(v) Oxide" → "Vanadium(V) oxide" (roman numeral oxidation
--     state, not a lowercase letter).
--   • "Nitric Acid Manufacturer" → "Nitric Acid Manufacture" (the process,
--     not the entity that carries it out — matches every other row's
--     "<noun> Manufacture" naming).
--   • US spellings ("colorless") normalised to the UK spellings ("colourless")
--     used throughout the rest of the source and the app's existing content.
--   • "redissolve" → "redissolves" (subject–verb agreement: "the precipitate
--     redissolves").
--   • FeSO4.6H2O → FeSO4.7H2O — iron(II) sulfate's common hydrate (green
--     vitriol) is the heptahydrate; the source's hexahydrate does exist but
--     is not the one meant alongside the other listed hydrates.
--
-- The reactivity-series table's cold-water/steam/HCl columns have five rows
-- that are "No reaction" across the board (carbon, hydrogen, copper, silver,
-- gold). A card per element there would give MatchingRound five cards with
-- an identical definition — the round is matched by array position, so a
-- student picking the *other* identical card is marked wrong. Collapsed into
-- one summary card instead of five near-duplicates; the seven elements that
-- do react each keep their own card with their own equations.
--
-- Unicode: ion charges, subscripts and reaction arrows (Li⁺, CO₂, →) are used
-- throughout, matching how this content is actually written and printed.
-- checkPass3Answer (src/lib/answerCheck.ts) does not strip these characters,
-- but every term that carries one is long enough after normalisation
-- (comma-stripped, >8 characters) to fall in its 2-edit Levenshtein
-- tolerance band, so typing the ASCII equivalent ("Li+" for "Li⁺") still
-- passes. The one chapter with short bare-word terms (Ion Charges and
-- Valencies) deliberately keeps the ion symbol out of the term — it lives in
-- the definition instead — so those terms stay plain, easily-typed English
-- words.

INSERT INTO public.recall_chapters
  (id, subject_id, subject_name, subject_emoji, section_id, section_name, name, sort_order, section_sort_order, subject_sort_order)
VALUES
  ('chemistry-flame-tests',          'chemistry', 'Chemistry', '🧪', 'chemistry-reference-tables', 'Reference Tables', 'Flame Tests',                 0, 0, 2),
  ('chemistry-cation-tests',         'chemistry', 'Chemistry', '🧪', 'chemistry-reference-tables', 'Reference Tables', 'Cation Tests with NH₃(aq)',   1, 0, 2),
  ('chemistry-anion-tests',          'chemistry', 'Chemistry', '🧪', 'chemistry-reference-tables', 'Reference Tables', 'Anion Tests',                 2, 0, 2),
  ('chemistry-gas-tests',            'chemistry', 'Chemistry', '🧪', 'chemistry-reference-tables', 'Reference Tables', 'Gas Tests',                   3, 0, 2),
  ('chemistry-ion-charges',          'chemistry', 'Chemistry', '🧪', 'chemistry-reference-tables', 'Reference Tables', 'Ion Charges and Valencies',   4, 0, 2),
  ('chemistry-industrial-catalysts', 'chemistry', 'Chemistry', '🧪', 'chemistry-reference-tables', 'Reference Tables', 'Industrial Catalysts',        5, 0, 2),
  ('chemistry-hydrated-salts',       'chemistry', 'Chemistry', '🧪', 'chemistry-reference-tables', 'Reference Tables', 'Hydrated Salts',              6, 0, 2),
  ('chemistry-reactivity-series',    'chemistry', 'Chemistry', '🧪', 'chemistry-reference-tables', 'Reference Tables', 'The Reactivity Series',       7, 0, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.recall_cards (chapter_id, term, definition, sort_order) VALUES
  -- chemistry-flame-tests
  ('chemistry-flame-tests','Lithium, Li⁺','Produces a red flame in the flame test.',0),
  ('chemistry-flame-tests','Sodium, Na⁺','Produces a yellow flame in the flame test.',1),
  ('chemistry-flame-tests','Potassium, K⁺','Produces a lilac flame in the flame test.',2),
  ('chemistry-flame-tests','Calcium, Ca²⁺','Produces an orange-red flame in the flame test.',3),
  ('chemistry-flame-tests','Barium, Ba²⁺','Produces a light green flame in the flame test.',4),
  ('chemistry-flame-tests','Copper, Cu²⁺','Produces a blue-green flame in the flame test.',5),
  -- chemistry-cation-tests
  ('chemistry-cation-tests','Aluminium, Al³⁺','Forms a white precipitate with NH₃(aq) that is insoluble in excess NH₃(aq).',0),
  ('chemistry-cation-tests','Ammonium, NH₄⁺','Shows no visible reaction when NH₃(aq) is added.',1),
  ('chemistry-cation-tests','Calcium, Ca²⁺','Forms no precipitate, or only a very slight white precipitate, with NH₃(aq).',2),
  ('chemistry-cation-tests','Chromium, Cr³⁺','Forms a green precipitate with NH₃(aq) that is insoluble in excess NH₃(aq).',3),
  ('chemistry-cation-tests','Copper, Cu²⁺','Forms a light blue precipitate with NH₃(aq) that dissolves in excess NH₃(aq) to give a dark blue solution.',4),
  ('chemistry-cation-tests','Iron(II), Fe²⁺','Forms a green precipitate with NH₃(aq) that is insoluble in excess NH₃(aq) but turns brown at the surface on standing.',5),
  ('chemistry-cation-tests','Iron(III), Fe³⁺','Forms a red-brown precipitate with NH₃(aq) that is insoluble in excess NH₃(aq).',6),
  ('chemistry-cation-tests','Zinc, Zn²⁺','Forms a white precipitate with NH₃(aq) that redissolves in excess NH₃(aq) to give a colourless solution.',7),
  -- chemistry-anion-tests
  ('chemistry-anion-tests','Carbonate, CO₃²⁻','Adding dilute hydrochloric acid to the solid causes effervescence, releasing carbon dioxide (turns limewater milky).',0),
  ('chemistry-anion-tests','Chloride, Cl⁻','Acidifying with dilute nitric acid then adding aqueous silver nitrate gives a white precipitate of silver chloride, soluble in ammonia solution.',1),
  ('chemistry-anion-tests','Bromide, Br⁻','Acidifying with dilute nitric acid then adding aqueous silver nitrate gives a cream precipitate of silver bromide, only slightly soluble in ammonia solution.',2),
  ('chemistry-anion-tests','Iodide, I⁻','Acidifying with dilute nitric acid then adding aqueous silver nitrate gives a yellow precipitate of silver iodide, insoluble in ammonia solution.',3),
  ('chemistry-anion-tests','Sulfate, SO₄²⁻','Acidifying with dilute hydrochloric acid then adding barium chloride solution gives a white precipitate of barium sulfate.',4),
  ('chemistry-anion-tests','Sulfite, SO₃²⁻','Adding dilute hydrochloric acid to the solid, then aqueous potassium manganate(VII) solution, decolourises the purple solution.',5),
  ('chemistry-anion-tests','Nitrate, NO₃⁻','Making the solution alkaline with sodium hydroxide, then adding aluminium foil and warming gently, releases ammonia gas (turns moist red litmus blue).',6),
  -- chemistry-gas-tests
  ('chemistry-gas-tests','Ammonia, NH₃','Colourless with a pungent smell; damp red litmus paper turns blue in the gas.',0),
  ('chemistry-gas-tests','Carbon Dioxide, CO₂','Colourless and odourless; bubbling through limewater gives a white precipitate of calcium carbonate, turning it milky.',1),
  ('chemistry-gas-tests','Chlorine, Cl₂','Pale green with a choking smell; damp litmus paper is bleached white in the gas (turning red first).',2),
  ('chemistry-gas-tests','Sulfur Dioxide, SO₂','Colourless with a pungent, acidic smell; turns purple potassium manganate(VII) solution colourless.',3),
  ('chemistry-gas-tests','Hydrogen, H₂','Colourless and odourless; burns with a squeaky pop when a lit splint is held in the gas.',4),
  ('chemistry-gas-tests','Oxygen, O₂','Colourless and odourless; relights a glowing splint held in the gas.',5),
  -- chemistry-ion-charges (valency 1)
  ('chemistry-ion-charges','Sodium','A valency-1 simple metal ion, formula Na⁺.',0),
  ('chemistry-ion-charges','Potassium','A valency-1 simple metal ion, formula K⁺.',1),
  ('chemistry-ion-charges','Silver','A valency-1 simple metal ion, formula Ag⁺.',2),
  ('chemistry-ion-charges','Copper(I)','A valency-1 simple metal ion, formula Cu⁺.',3),
  ('chemistry-ion-charges','Hydrogen','A valency-1 simple non-metal ion, formula H⁺.',4),
  ('chemistry-ion-charges','Hydride','A valency-1 simple non-metal ion, formula H⁻.',5),
  ('chemistry-ion-charges','Chloride','A valency-1 simple non-metal ion, formula Cl⁻.',6),
  ('chemistry-ion-charges','Bromide','A valency-1 simple non-metal ion, formula Br⁻.',7),
  ('chemistry-ion-charges','Iodide','A valency-1 simple non-metal ion, formula I⁻.',8),
  ('chemistry-ion-charges','Ammonium','A valency-1 polyatomic ion, formula NH₄⁺.',9),
  ('chemistry-ion-charges','Hydroxide','A valency-1 polyatomic ion, formula OH⁻.',10),
  ('chemistry-ion-charges','Nitrate','A valency-1 polyatomic ion, formula NO₃⁻.',11),
  ('chemistry-ion-charges','Hydrogencarbonate','A valency-1 polyatomic ion, formula HCO₃⁻.',12),
  -- chemistry-ion-charges (valency 2)
  ('chemistry-ion-charges','Magnesium','A valency-2 simple metal ion, formula Mg²⁺.',13),
  ('chemistry-ion-charges','Calcium','A valency-2 simple metal ion, formula Ca²⁺.',14),
  ('chemistry-ion-charges','Zinc','A valency-2 simple metal ion, formula Zn²⁺.',15),
  ('chemistry-ion-charges','Iron(II)','A valency-2 simple metal ion, formula Fe²⁺.',16),
  ('chemistry-ion-charges','Copper(II)','A valency-2 simple metal ion, formula Cu²⁺.',17),
  ('chemistry-ion-charges','Oxide','A valency-2 simple non-metal ion, formula O²⁻.',18),
  ('chemistry-ion-charges','Sulfide','A valency-2 simple non-metal ion, formula S²⁻.',19),
  ('chemistry-ion-charges','Sulfate','A valency-2 polyatomic ion, formula SO₄²⁻.',20),
  ('chemistry-ion-charges','Carbonate','A valency-2 polyatomic ion, formula CO₃²⁻.',21),
  -- chemistry-ion-charges (valency 3)
  ('chemistry-ion-charges','Aluminium','A valency-3 simple metal ion, formula Al³⁺.',22),
  ('chemistry-ion-charges','Iron(III)','A valency-3 simple metal ion, formula Fe³⁺.',23),
  ('chemistry-ion-charges','Nitride','A valency-3 simple non-metal ion, formula N³⁻.',24),
  ('chemistry-ion-charges','Phosphate','A valency-3 polyatomic ion, formula PO₄³⁻.',25),
  -- chemistry-industrial-catalysts
  ('chemistry-industrial-catalysts','Ammonia Manufacture (Haber Process)','Uses an iron catalyst.',0),
  ('chemistry-industrial-catalysts','Sulfuric Acid Manufacture (Contact Process)','Uses a vanadium(V) oxide catalyst.',1),
  ('chemistry-industrial-catalysts','Margarine Production (Hydrogenation of Fats)','Uses a nickel catalyst.',2),
  ('chemistry-industrial-catalysts','Nitric Acid Manufacture (Oxidation of Ammonia)','Uses a platinum-rhodium catalyst.',3),
  ('chemistry-industrial-catalysts','Fermentation of Sugars (Alcoholic Drinks Industry)','Uses enzymes in yeast as the catalyst.',4),
  ('chemistry-industrial-catalysts','Conversion of Methanol to Hydrocarbons','Uses a zeolite ZSM-5 catalyst.',5),
  -- chemistry-hydrated-salts
  ('chemistry-hydrated-salts','Copper(II) Sulfate','Formula CuSO₄·5H₂O; blue crystals.',0),
  ('chemistry-hydrated-salts','Cobalt(II) Chloride','Formula CoCl₂·6H₂O; pink crystals.',1),
  ('chemistry-hydrated-salts','Iron(II) Sulfate','Formula FeSO₄·7H₂O; green crystals.',2),
  ('chemistry-hydrated-salts','Magnesium Sulfate','Formula MgSO₄·7H₂O; white crystals.',3),
  ('chemistry-hydrated-salts','Sodium Carbonate','Formula Na₂CO₃·10H₂O; white crystals.',4),
  ('chemistry-hydrated-salts','Calcium Sulfate','Formula CaSO₄·2H₂O; white crystals.',5),
  -- chemistry-reactivity-series
  ('chemistry-reactivity-series','Potassium, K','Reacts violently with cold water and steam (2K + 2H₂O → 2KOH + H₂) and with dilute hydrochloric acid (2K + 2HCl → 2KCl + H₂).',0),
  ('chemistry-reactivity-series','Sodium, Na','Reacts with cold water and steam (2Na + 2H₂O → 2NaOH + H₂) and with dilute hydrochloric acid (2Na + 2HCl → 2NaCl + H₂).',1),
  ('chemistry-reactivity-series','Calcium, Ca','Reacts with cold water and steam (Ca + 2H₂O → Ca(OH)₂ + H₂) and with dilute hydrochloric acid (Ca + 2HCl → CaCl₂ + H₂).',2),
  ('chemistry-reactivity-series','Magnesium, Mg','Does not react with cold water; reacts with steam (Mg + H₂O → MgO + H₂) and with dilute hydrochloric acid (Mg + 2HCl → MgCl₂ + H₂).',3),
  ('chemistry-reactivity-series','Aluminium, Al','Does not react with cold water or steam; reacts with dilute hydrochloric acid (2Al + 6HCl → 2AlCl₃ + 3H₂).',4),
  ('chemistry-reactivity-series','Zinc, Zn','Does not react with cold water or steam; reacts with dilute hydrochloric acid (Zn + 2HCl → ZnCl₂ + H₂).',5),
  ('chemistry-reactivity-series','Iron, Fe','Does not react with cold water or steam; reacts with dilute hydrochloric acid (Fe + 2HCl → FeCl₂ + H₂).',6),
  ('chemistry-reactivity-series','Carbon, Hydrogen, Copper, Silver and Gold','None of these five react with cold water, steam, or dilute hydrochloric acid.',7)
ON CONFLICT DO NOTHING;
