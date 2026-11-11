-- ── Chemistry definitions for Recall Master ─────────────────────────────────────
-- Adds a second Chemistry section, 'Definitions', beside 'Reference Tables'
-- (20260914000000). It holds one chapter, 'Syllabus Definitions', with all 55
-- definitions from the Cambridge IGCSE Chemistry 0620 (2026–2028 syllabus)
-- definitions list: the 20 terms the syllabus says to "Define" plus the 35
-- other fixed meanings it states in "State that…" / "Describe X as…" form.
--
-- The source list is split by Part A / Part B and by Core / Supplement. None of
-- that is carried over: every definition is one flat card in one chapter, ordered
-- by syllabus reference (2.2.3 → 12.3.4) so the chapter reads in syllabus order.
--
-- No schema change — pure content, same as 20260914000000. Wording is the
-- syllabus's own (Pass 4 credits its key words), with a trailing full stop added
-- to match the other Chemistry cards. Formulae use the Unicode subscripts and
-- superscripts already used in this subject (CuSO₄·5H₂O, 6.02 × 10²³).
--
-- Sort orders: section_sort_order 1 (Reference Tables is 0), subject_sort_order 2
-- (unchanged — Chemistry stays after economics=0 and physics=1), chapter
-- sort_order 8 (the existing eight chapters are 0..7, and sort_order is dense
-- across the subject).
--
-- MatchingRound matches Pass 1 strictly by array position, so no two cards in a
-- chapter may share a definition or a term; every entry below is distinct, and
-- recall-chemistry.test.ts asserts it.

INSERT INTO public.recall_chapters
  (id, subject_id, subject_name, subject_emoji, section_id, section_name, name, sort_order, section_sort_order, subject_sort_order)
VALUES
  ('chemistry-definitions', 'chemistry', 'Chemistry', '🧪', 'chemistry-definitions-section', 'Definitions', 'Syllabus Definitions', 8, 1, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.recall_cards (chapter_id, term, definition, sort_order) VALUES
  ('chemistry-definitions','Proton number / atomic number','The number of protons in the nucleus of an atom.',0),
  ('chemistry-definitions','Mass number / nucleon number','The total number of protons and neutrons in the nucleus of an atom.',1),
  ('chemistry-definitions','Isotopes','Different atoms of the same element that have the same number of protons but different numbers of neutrons.',2),
  ('chemistry-definitions','Cation and anion','Positive ions are known as cations; negative ions are known as anions.',3),
  ('chemistry-definitions','Ionic bond','A strong electrostatic attraction between oppositely charged ions.',4),
  ('chemistry-definitions','Giant ionic lattice','A regular arrangement of alternating positive and negative ions.',5),
  ('chemistry-definitions','Covalent bond','Formed when a pair of electrons is shared between two atoms leading to noble gas electronic configurations.',6),
  ('chemistry-definitions','Metallic bonding','The electrostatic attraction between the positive ions in a giant metallic lattice and a ‘sea’ of delocalised electrons.',7),
  ('chemistry-definitions','Molecular formula','The number and type of different atoms in one molecule.',8),
  ('chemistry-definitions','Empirical formula','The simplest whole number ratio of the different atoms or ions in a compound.',9),
  ('chemistry-definitions','Relative atomic mass, Ar','The average mass of the isotopes of an element compared to 1/12th of the mass of an atom of carbon-12.',10),
  ('chemistry-definitions','Relative molecular mass, Mr','The sum of the relative atomic masses (relative formula mass, Mr, is used for ionic compounds).',11),
  ('chemistry-definitions','Mole and Avogadro constant','The mole, mol, is the unit of amount of substance; one mole contains 6.02 × 10²³ particles (e.g. atoms, ions, molecules); this number is the Avogadro constant.',12),
  ('chemistry-definitions','Electrolysis','The decomposition of an ionic compound, when molten or in aqueous solution, by the passage of an electric current.',13),
  ('chemistry-definitions','Anode, cathode, electrolyte','The anode is the positive electrode; the cathode is the negative electrode; the electrolyte is the molten or aqueous substance that undergoes electrolysis.',14),
  ('chemistry-definitions','Hydrogen–oxygen fuel cell','Uses hydrogen and oxygen to produce electricity with water as the only chemical product.',15),
  ('chemistry-definitions','Exothermic reaction','Transfers thermal energy to the surroundings leading to an increase in the temperature of the surroundings.',16),
  ('chemistry-definitions','Endothermic reaction','Takes in thermal energy from the surroundings leading to a decrease in the temperature of the surroundings.',17),
  ('chemistry-definitions','Enthalpy change, ΔH','The transfer of thermal energy during a reaction; ΔH is negative for exothermic reactions and positive for endothermic reactions.',18),
  ('chemistry-definitions','Activation energy, Ea','The minimum energy that colliding particles must have to react.',19),
  ('chemistry-definitions','Bond breaking and bond making','Bond breaking is an endothermic process; bond making is an exothermic process.',20),
  ('chemistry-definitions','Catalyst','Increases the rate of a reaction and is unchanged at the end of a reaction.',21),
  ('chemistry-definitions','Catalyst (activation energy)','A catalyst decreases the activation energy, Ea, of a reaction.',22),
  ('chemistry-definitions','Equilibrium','A reversible reaction in a closed system is at equilibrium when the rate of the forward reaction is equal to the rate of the reverse reaction, and the concentrations of reactants and products are no longer changing.',23),
  ('chemistry-definitions','Redox reactions','Reactions involving simultaneous oxidation and reduction.',24),
  ('chemistry-definitions','Oxidation and reduction (oxygen)','Oxidation is gain of oxygen; reduction is loss of oxygen.',25),
  ('chemistry-definitions','Oxidation (electrons / oxidation number)','Loss of electrons; an increase in oxidation number.',26),
  ('chemistry-definitions','Reduction (electrons / oxidation number)','Gain of electrons; a decrease in oxidation number.',27),
  ('chemistry-definitions','Oxidising agent','A substance that oxidises another substance and is itself reduced.',28),
  ('chemistry-definitions','Reducing agent','A substance that reduces another substance and is itself oxidised.',29),
  ('chemistry-definitions','Bases and alkalis','Bases are oxides or hydroxides of metals; alkalis are soluble bases.',30),
  ('chemistry-definitions','Acids and bases (proton definition)','Acids are proton donors; bases are proton acceptors.',31),
  ('chemistry-definitions','Strong acid and weak acid','A strong acid is completely dissociated in aqueous solution; a weak acid is partially dissociated in aqueous solution.',32),
  ('chemistry-definitions','Amphoteric oxides','Oxides that react with acids and with bases to produce a salt and water.',33),
  ('chemistry-definitions','Hydrated and anhydrous substance','Hydrated: a substance that is chemically combined with water. Anhydrous: a substance containing no water.',34),
  ('chemistry-definitions','Water of crystallisation','The water molecules present in hydrated crystals, including CuSO₄·5H₂O and CoCl₂·6H₂O.',35),
  ('chemistry-definitions','Alloy','A mixture of a metal with other elements.',36),
  ('chemistry-definitions','Displayed formula','Shows all the atoms and all the bonds in a molecule.',37),
  ('chemistry-definitions','Functional group','An atom or group of atoms that determine the chemical properties of a homologous series.',38),
  ('chemistry-definitions','Homologous series','A family of similar compounds with similar chemical properties due to the presence of the same functional group.',39),
  ('chemistry-definitions','Saturated compound','Has molecules in which all carbon–carbon bonds are single bonds.',40),
  ('chemistry-definitions','Unsaturated compound','Has molecules in which one or more carbon–carbon bonds are not single bonds.',41),
  ('chemistry-definitions','Structural formula','An unambiguous description of the way the atoms in a molecule are arranged.',42),
  ('chemistry-definitions','Structural isomers','Compounds with the same molecular formula, but different structural formulae.',43),
  ('chemistry-definitions','Hydrocarbons','Compounds that contain hydrogen and carbon only.',44),
  ('chemistry-definitions','Substitution reaction','One atom or group of atoms is replaced by another atom or group of atoms.',45),
  ('chemistry-definitions','Addition reaction','Only one product is formed.',46),
  ('chemistry-definitions','Polymers','Large molecules built up from many smaller molecules called monomers.',47),
  ('chemistry-definitions','Solvent','A substance that dissolves a solute.',48),
  ('chemistry-definitions','Solute','A substance that is dissolved in a solvent.',49),
  ('chemistry-definitions','Solution','A mixture of one or more solutes dissolved in a solvent.',50),
  ('chemistry-definitions','Saturated solution','A solution containing the maximum concentration of a solute dissolved in the solvent at a specified temperature.',51),
  ('chemistry-definitions','Residue','A substance that remains after evaporation, distillation, filtration or any similar process.',52),
  ('chemistry-definitions','Filtrate','A liquid or solution that has passed through a filter.',53),
  ('chemistry-definitions','Rf value','Rf = distance travelled by substance ÷ distance travelled by solvent.',54)
ON CONFLICT DO NOTHING;
