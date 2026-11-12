-- ── Chemistry definitions for Recall Master ─────────────────────────────────────
-- Adds a second Chemistry section, 'Definitions', beside 'Reference Tables'
-- (20260914000000). It holds all 55 definitions from the Cambridge IGCSE
-- Chemistry 0620 (2026–2028 syllabus) definitions list: the 20 terms the
-- syllabus says to "Define" plus the 35 other fixed meanings it states in
-- "State that…" / "Describe X as…" form.
--
-- The source list is split by Part A / Part B and by Core / Supplement. None of
-- that is carried over. Instead the 55 cards are broken into eight small
-- topic chapters (3–9 cards each) so no single study set is daunting; within a
-- chapter, cards follow syllabus-reference order (2.2.3 → 12.3.4).
--
-- No schema change — pure content, same as 20260914000000. Wording is the
-- syllabus's own (Pass 4 credits its key words), with a trailing full stop added
-- to match the other Chemistry cards. Formulae use the Unicode subscripts and
-- superscripts already used in this subject (CuSO₄·5H₂O, 6.02 × 10²³).
--
-- Sort orders: section_sort_order 1 (Reference Tables is 0), subject_sort_order 2
-- (unchanged), chapter sort_order 8..15 (the existing eight chapters are 0..7,
-- and sort_order is dense across the subject).
--
-- MatchingRound matches Pass 1 strictly by array position, so no two cards in a
-- chapter may share a definition or a term; every entry below is distinct, and
-- recall-chemistry.test.ts asserts it.

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

INSERT INTO public.recall_cards (chapter_id, term, definition, sort_order) VALUES
  -- chemistry-definitions-atoms-bonding
  ('chemistry-definitions-atoms-bonding','Proton number / atomic number','The number of protons in the nucleus of an atom.',0),
  ('chemistry-definitions-atoms-bonding','Mass number / nucleon number','The total number of protons and neutrons in the nucleus of an atom.',1),
  ('chemistry-definitions-atoms-bonding','Isotopes','Different atoms of the same element that have the same number of protons but different numbers of neutrons.',2),
  ('chemistry-definitions-atoms-bonding','Cation and anion','Positive ions are known as cations; negative ions are known as anions.',3),
  ('chemistry-definitions-atoms-bonding','Ionic bond','A strong electrostatic attraction between oppositely charged ions.',4),
  ('chemistry-definitions-atoms-bonding','Giant ionic lattice','A regular arrangement of alternating positive and negative ions.',5),
  ('chemistry-definitions-atoms-bonding','Covalent bond','Formed when a pair of electrons is shared between two atoms leading to noble gas electronic configurations.',6),
  ('chemistry-definitions-atoms-bonding','Metallic bonding','The electrostatic attraction between the positive ions in a giant metallic lattice and a ‘sea’ of delocalised electrons.',7),
  -- chemistry-definitions-formulae-mole
  ('chemistry-definitions-formulae-mole','Molecular formula','The number and type of different atoms in one molecule.',0),
  ('chemistry-definitions-formulae-mole','Empirical formula','The simplest whole number ratio of the different atoms or ions in a compound.',1),
  ('chemistry-definitions-formulae-mole','Relative atomic mass, Ar','The average mass of the isotopes of an element compared to 1/12th of the mass of an atom of carbon-12.',2),
  ('chemistry-definitions-formulae-mole','Relative molecular mass, Mr','The sum of the relative atomic masses (relative formula mass, Mr, is used for ionic compounds).',3),
  ('chemistry-definitions-formulae-mole','Mole and Avogadro constant','The mole, mol, is the unit of amount of substance; one mole contains 6.02 × 10²³ particles (e.g. atoms, ions, molecules); this number is the Avogadro constant.',4),
  -- chemistry-definitions-electrolysis-energy
  ('chemistry-definitions-electrolysis-energy','Electrolysis','The decomposition of an ionic compound, when molten or in aqueous solution, by the passage of an electric current.',0),
  ('chemistry-definitions-electrolysis-energy','Anode, cathode, electrolyte','The anode is the positive electrode; the cathode is the negative electrode; the electrolyte is the molten or aqueous substance that undergoes electrolysis.',1),
  ('chemistry-definitions-electrolysis-energy','Hydrogen–oxygen fuel cell','Uses hydrogen and oxygen to produce electricity with water as the only chemical product.',2),
  ('chemistry-definitions-electrolysis-energy','Exothermic reaction','Transfers thermal energy to the surroundings leading to an increase in the temperature of the surroundings.',3),
  ('chemistry-definitions-electrolysis-energy','Endothermic reaction','Takes in thermal energy from the surroundings leading to a decrease in the temperature of the surroundings.',4),
  ('chemistry-definitions-electrolysis-energy','Enthalpy change, ΔH','The transfer of thermal energy during a reaction; ΔH is negative for exothermic reactions and positive for endothermic reactions.',5),
  ('chemistry-definitions-electrolysis-energy','Activation energy, Ea','The minimum energy that colliding particles must have to react.',6),
  ('chemistry-definitions-electrolysis-energy','Bond breaking and bond making','Bond breaking is an endothermic process; bond making is an exothermic process.',7),
  -- chemistry-definitions-rates-equilibrium-redox
  ('chemistry-definitions-rates-equilibrium-redox','Catalyst','Increases the rate of a reaction and is unchanged at the end of a reaction.',0),
  ('chemistry-definitions-rates-equilibrium-redox','Catalyst (activation energy)','A catalyst decreases the activation energy, Ea, of a reaction.',1),
  ('chemistry-definitions-rates-equilibrium-redox','Equilibrium','A reversible reaction in a closed system is at equilibrium when the rate of the forward reaction is equal to the rate of the reverse reaction, and the concentrations of reactants and products are no longer changing.',2),
  ('chemistry-definitions-rates-equilibrium-redox','Redox reactions','Reactions involving simultaneous oxidation and reduction.',3),
  ('chemistry-definitions-rates-equilibrium-redox','Oxidation and reduction (oxygen)','Oxidation is gain of oxygen; reduction is loss of oxygen.',4),
  ('chemistry-definitions-rates-equilibrium-redox','Oxidation (electrons / oxidation number)','Loss of electrons; an increase in oxidation number.',5),
  ('chemistry-definitions-rates-equilibrium-redox','Reduction (electrons / oxidation number)','Gain of electrons; a decrease in oxidation number.',6),
  ('chemistry-definitions-rates-equilibrium-redox','Oxidising agent','A substance that oxidises another substance and is itself reduced.',7),
  ('chemistry-definitions-rates-equilibrium-redox','Reducing agent','A substance that reduces another substance and is itself oxidised.',8),
  -- chemistry-definitions-acids-salts-alloys
  ('chemistry-definitions-acids-salts-alloys','Bases and alkalis','Bases are oxides or hydroxides of metals; alkalis are soluble bases.',0),
  ('chemistry-definitions-acids-salts-alloys','Acids and bases (proton definition)','Acids are proton donors; bases are proton acceptors.',1),
  ('chemistry-definitions-acids-salts-alloys','Strong acid and weak acid','A strong acid is completely dissociated in aqueous solution; a weak acid is partially dissociated in aqueous solution.',2),
  ('chemistry-definitions-acids-salts-alloys','Amphoteric oxides','Oxides that react with acids and with bases to produce a salt and water.',3),
  ('chemistry-definitions-acids-salts-alloys','Hydrated and anhydrous substance','Hydrated: a substance that is chemically combined with water. Anhydrous: a substance containing no water.',4),
  ('chemistry-definitions-acids-salts-alloys','Water of crystallisation','The water molecules present in hydrated crystals, including CuSO₄·5H₂O and CoCl₂·6H₂O.',5),
  ('chemistry-definitions-acids-salts-alloys','Alloy','A mixture of a metal with other elements.',6),
  -- chemistry-definitions-organic-formulae
  ('chemistry-definitions-organic-formulae','Displayed formula','Shows all the atoms and all the bonds in a molecule.',0),
  ('chemistry-definitions-organic-formulae','Structural formula','An unambiguous description of the way the atoms in a molecule are arranged.',1),
  ('chemistry-definitions-organic-formulae','Structural isomers','Compounds with the same molecular formula, but different structural formulae.',2),
  ('chemistry-definitions-organic-formulae','Functional group','An atom or group of atoms that determine the chemical properties of a homologous series.',3),
  ('chemistry-definitions-organic-formulae','Homologous series','A family of similar compounds with similar chemical properties due to the presence of the same functional group.',4),
  ('chemistry-definitions-organic-formulae','Hydrocarbons','Compounds that contain hydrogen and carbon only.',5),
  -- chemistry-definitions-organic-reactions
  ('chemistry-definitions-organic-reactions','Saturated compound','Has molecules in which all carbon–carbon bonds are single bonds.',0),
  ('chemistry-definitions-organic-reactions','Unsaturated compound','Has molecules in which one or more carbon–carbon bonds are not single bonds.',1),
  ('chemistry-definitions-organic-reactions','Substitution reaction','One atom or group of atoms is replaced by another atom or group of atoms.',2),
  ('chemistry-definitions-organic-reactions','Addition reaction','Only one product is formed.',3),
  ('chemistry-definitions-organic-reactions','Polymers','Large molecules built up from many smaller molecules called monomers.',4),
  -- chemistry-definitions-solutions-separation
  ('chemistry-definitions-solutions-separation','Solvent','A substance that dissolves a solute.',0),
  ('chemistry-definitions-solutions-separation','Solute','A substance that is dissolved in a solvent.',1),
  ('chemistry-definitions-solutions-separation','Solution','A mixture of one or more solutes dissolved in a solvent.',2),
  ('chemistry-definitions-solutions-separation','Saturated solution','A solution containing the maximum concentration of a solute dissolved in the solvent at a specified temperature.',3),
  ('chemistry-definitions-solutions-separation','Residue','A substance that remains after evaporation, distillation, filtration or any similar process.',4),
  ('chemistry-definitions-solutions-separation','Filtrate','A liquid or solution that has passed through a filter.',5),
  ('chemistry-definitions-solutions-separation','Rf value','Rf = distance travelled by substance ÷ distance travelled by solvent.',6)
ON CONFLICT DO NOTHING;
