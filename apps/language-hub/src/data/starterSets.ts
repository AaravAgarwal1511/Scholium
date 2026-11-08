/**
 * Curated starter vocabulary sets, shipped in the bundle (not the database).
 *
 * A new user's dashboard is empty until they hand-type a set; these give them
 * something to study on day one. The `/starter-sets` page lists them and imports
 * the chosen one into `vocabulary_sets` / `vocabulary_items` via
 * `createSetWithItems` in `@/lib/sets` — an imported set is an ordinary,
 * fully-editable copy, unlinked from these files afterwards.
 *
 * Kept as static data rather than DB rows on purpose: this app's RLS is
 * USING(true), so a template row in the database could be edited or deleted by
 * any user. Git-tracked modules also get PR review for content changes.
 *
 * ## Shape: light catalog here, heavy items in JSON
 *
 * The sets are derived from the Cambridge IGCSE French 0520 / Spanish 0530
 * vocabulary lists and run to ~3,000 items. Inlining them here would bloat the
 * main bundle (this module is imported eagerly by the catalog page). Instead:
 *
 *   - `STARTER_SETS` below holds only the catalog metadata — id, name, blurb,
 *     `count`, and a 5-item `preview` — enough to render the grid without
 *     touching a single item list.
 *   - the items live one-file-per-set in `./starter-sets/<id>.json`, pulled in
 *     on demand by `loadStarterSetItems`. Vite emits one async chunk per file,
 *     so importing a set downloads a few KB, not the whole corpus.
 *
 * `count` and `preview` are hand-maintained and must stay in sync with the JSON;
 * `starterSets.test.ts` fails the build if they drift.
 *
 * `language` must be exactly "french" | "spanish" — the only two values the
 * SetCard badge and the Create/Edit language selectors understand. Adding a set
 * needs a deploy; that is the accepted trade for the safety above.
 */

export interface StarterSetItem {
  term: string;
  definition: string;
}

export interface StarterSet {
  /** Stable slug, used as the analytics id, the React key, and the JSON filename. Never reused. */
  id: string;
  name: string;
  description: string;
  language: "french" | "spanish";
  /**
   * Topic key shared by the French and Spanish set on the same subject, so the
   * two catalogs stay parallel even though the source workbooks group terms
   * differently. Not shown in the UI today; kept for a future topic filter.
   */
  topic: string;
  /** Total item count, for the card badge. The JSON is not loaded to render the grid. */
  count: number;
  /** First `count`-or-5 items, inlined so the card preview stays synchronous. */
  preview: StarterSetItem[];
}

/**
 * Lazily loaded item lists, keyed by `./starter-sets/<id>.json`. Non-eager on
 * purpose — see the module comment. One Vite chunk per set.
 */
const ITEM_FILES = import.meta.glob<{ items: StarterSetItem[] }>("./starter-sets/*.json");

/** Fetch the full item list for a starter set. Throws if the JSON file is missing. */
export async function loadStarterSetItems(id: string): Promise<StarterSetItem[]> {
  const load = ITEM_FILES[`./starter-sets/${id}.json`];
  if (!load) throw new Error(`No items file for starter set "${id}"`);
  return (await load()).items;
}

export const STARTER_SETS: StarterSet[] = [
  {
    id: "fr-adjectives",
    name: "French — Common Adjectives",
    description: "Everyday describing words.",
    language: "french",
    topic: "adjectives",
    count: 98,
    preview: [
      { term: "agréable", definition: "pleasant" },
      { term: "amical", definition: "friendly" },
      { term: "amusant", definition: "fun" },
      { term: "animé", definition: "lively" },
      { term: "approprié", definition: "appropriate" },
    ],
  },
  {
    id: "fr-verbs",
    name: "French — Common Verbs",
    description: "The high-frequency verbs you meet everywhere.",
    language: "french",
    topic: "verbs",
    count: 118,
    preview: [
      { term: "accompagner", definition: "to accompany" },
      { term: "accueillir", definition: "to welcome" },
      { term: "adorer", definition: "to adore" },
      { term: "aider", definition: "to help" },
      { term: "aimer", definition: "to like" },
    ],
  },
  {
    id: "fr-adverbs-prepositions",
    name: "French — Adverbs & Prepositions",
    description: "Words for where, when, how much and how often.",
    language: "french",
    topic: "adverbs-prepositions",
    count: 53,
    preview: [
      { term: "à", definition: "at" },
      { term: "à côté de", definition: "next to" },
      { term: "au lieu de", definition: "instead of" },
      { term: "au milieu de", definition: "in the middle of" },
      { term: "au-dessous de", definition: "below" },
    ],
  },
  {
    id: "fr-numbers",
    name: "French — Numbers",
    description: "Counting, ordinals and quantity words.",
    language: "french",
    topic: "numbers",
    count: 65,
    preview: [
      { term: "zéro", definition: "zero" },
      { term: "un", definition: "one" },
      { term: "deux", definition: "two" },
      { term: "trois", definition: "three" },
      { term: "quatre", definition: "four" },
    ],
  },
  {
    id: "fr-time-dates",
    name: "French — Time & Dates",
    description: "Telling the time, days, months and seasons.",
    language: "french",
    topic: "time-dates",
    count: 79,
    preview: [
      { term: "l'heure", definition: "hour" },
      { term: "la minute", definition: "minute" },
      { term: "la seconde", definition: "second" },
      { term: "la montre", definition: "watch" },
      { term: "l'horloge", definition: "clock" },
    ],
  },
  {
    id: "fr-body-health",
    name: "French — Body & Health",
    description: "Parts of the body, illness and staying well.",
    language: "french",
    topic: "body-health",
    count: 55,
    preview: [
      { term: "le corps", definition: "body" },
      { term: "la tête", definition: "head" },
      { term: "le visage", definition: "face" },
      { term: "la bouche", definition: "mouth" },
      { term: "le nez", definition: "nose" },
    ],
  },
  {
    id: "fr-travel-transport",
    name: "French — Travel & Transport",
    description: "Getting around by road, rail, sea and air.",
    language: "french",
    topic: "travel-transport",
    count: 48,
    preview: [
      { term: "le voyage", definition: "trip" },
      { term: "le trajet", definition: "journey" },
      { term: "la visite", definition: "visit" },
      { term: "voyager", definition: "to travel" },
      { term: "voyager en autobus", definition: "to travel by bus" },
    ],
  },
  {
    id: "fr-food",
    name: "French — Food",
    description: "What's on the plate — from bread to seafood.",
    language: "french",
    topic: "food",
    count: 103,
    preview: [
      { term: "le pain", definition: "bread" },
      { term: "le pain grillé", definition: "toast" },
      { term: "le beurre", definition: "butter" },
      { term: "le fromage", definition: "cheese" },
      { term: "l'œuf", definition: "egg" },
    ],
  },
  {
    id: "fr-drink",
    name: "French — Drink & Tableware",
    description: "Drinks, and the cups and cutlery they come with.",
    language: "french",
    topic: "drink",
    count: 21,
    preview: [
      { term: "la boisson", definition: "drink" },
      { term: "la boisson non alcoolisée", definition: "soft drink" },
      { term: "l'eau", definition: "water" },
      { term: "le lait", definition: "milk" },
      { term: "le jus", definition: "juice" },
    ],
  },
  {
    id: "fr-greetings-social",
    name: "French — Greetings & Social",
    description: "Hellos, goodbyes, courtesies and invitations.",
    language: "french",
    topic: "greetings-social",
    count: 20,
    preview: [
      { term: "bonjour", definition: "hello" },
      { term: "bonsoir", definition: "good evening" },
      { term: "salut", definition: "hi" },
      { term: "au revoir", definition: "goodbye" },
      { term: "à plus tard", definition: "see you later" },
    ],
  },
  {
    id: "fr-family",
    name: "French — Family & Relationships",
    description: "Relatives, friends and life events.",
    language: "french",
    topic: "family",
    count: 58,
    preview: [
      { term: "la famille", definition: "family" },
      { term: "le membre de la famille", definition: "family member" },
      { term: "les parents", definition: "parents" },
      { term: "la mère", definition: "mother" },
      { term: "le père", definition: "father" },
    ],
  },
  {
    id: "fr-describing-people",
    name: "French — Describing People",
    description: "Appearance, character and mood.",
    language: "french",
    topic: "describing-people",
    count: 50,
    preview: [
      { term: "l'âge", definition: "age" },
      { term: "le sexe", definition: "sex" },
      { term: "la taille", definition: "height" },
      { term: "la voix", definition: "voice" },
      { term: "la couleur", definition: "colour" },
    ],
  },
  {
    id: "fr-home-rooms",
    name: "French — The Home",
    description: "Rooms, furniture and daily routines at home.",
    language: "french",
    topic: "home-rooms",
    count: 80,
    preview: [
      { term: "la salle à manger", definition: "dining room" },
      { term: "la cuisine", definition: "kitchen" },
      { term: "le salon", definition: "living room" },
      { term: "le séjour", definition: "lounge" },
      { term: "la chambre", definition: "bedroom" },
    ],
  },
  {
    id: "fr-home-appliances",
    name: "French — Household & Chores",
    description: "Appliances, gadgets and keeping house.",
    language: "french",
    topic: "home-appliances",
    count: 34,
    preview: [
      { term: "l'aspirateur", definition: "vacuum cleaner" },
      { term: "la machine à laver", definition: "washing machine" },
      { term: "le lave-vaisselle", definition: "dishwasher" },
      { term: "le frigo", definition: "fridge" },
      { term: "le congélateur", definition: "freezer" },
    ],
  },
  {
    id: "fr-clothes-colours",
    name: "French — Clothes & Colours",
    description: "Garments, accessories and every colour.",
    language: "french",
    topic: "clothes-colours",
    count: 61,
    preview: [
      { term: "blanc", definition: "white" },
      { term: "noir", definition: "black" },
      { term: "rouge", definition: "red" },
      { term: "bleu", definition: "blue" },
      { term: "vert", definition: "green" },
    ],
  },
  {
    id: "fr-hobbies-sport",
    name: "French — Hobbies & Sport",
    description: "Free time, music, games and every sport.",
    language: "french",
    topic: "hobbies-sport",
    count: 64,
    preview: [
      { term: "écouter de la musique", definition: "to listen to music" },
      { term: "regarder la télévision", definition: "to watch television" },
      { term: "aller à un concert", definition: "to go to a concert" },
      { term: "chatter en ligne", definition: "to chat online" },
      { term: "prendre des photos", definition: "to take photos" },
    ],
  },
  {
    id: "fr-geography",
    name: "French — Places & Geography",
    description: "Continents, countries and compass points.",
    language: "french",
    topic: "geography",
    count: 15,
    preview: [
      { term: "le continent", definition: "continent" },
      { term: "l'Afrique", definition: "Africa" },
      { term: "l'Amérique", definition: "America" },
      { term: "l'Asie", definition: "Asia" },
      { term: "l'Europe", definition: "Europe" },
    ],
  },
  {
    id: "fr-nature-environment",
    name: "French — Nature & Environment",
    description: "Landscape, wildlife and the environment.",
    language: "french",
    topic: "nature-environment",
    count: 66,
    preview: [
      { term: "la nature", definition: "nature" },
      { term: "le monde", definition: "the world" },
      { term: "la terre", definition: "earth" },
      { term: "la planète", definition: "planet" },
      { term: "le soleil", definition: "sun" },
    ],
  },
  {
    id: "fr-weather",
    name: "French — Weather & Climate",
    description: "Describing the weather in every season.",
    language: "french",
    topic: "weather",
    count: 28,
    preview: [
      { term: "le temps", definition: "weather" },
      { term: "la météo", definition: "weather forecast" },
      { term: "les conditions météorologiques", definition: "weather conditions" },
      { term: "la saison", definition: "season" },
      { term: "le degré", definition: "degree" },
    ],
  },
  {
    id: "fr-technology",
    name: "French — Technology & Media",
    description: "Devices, the internet and things to read.",
    language: "french",
    topic: "technology",
    count: 69,
    preview: [
      { term: "l'ordinateur", definition: "computer" },
      { term: "l'ordinateur portable", definition: "laptop" },
      { term: "la tablette électronique", definition: "tablet" },
      { term: "le téléphone portable", definition: "mobile phone" },
      { term: "l'écran", definition: "screen" },
    ],
  },
  {
    id: "fr-town-shopping",
    name: "French — Town & Shopping",
    description: "Around town, and buying and returning things.",
    language: "french",
    topic: "town-shopping",
    count: 82,
    preview: [
      { term: "la ville", definition: "town" },
      { term: "le village", definition: "village" },
      { term: "le quartier", definition: "neighbourhood" },
      { term: "le bâtiment", definition: "building" },
      { term: "la maison", definition: "house" },
    ],
  },
  {
    id: "fr-measurements",
    name: "French — Measurements & Materials",
    description: "Units, shapes and what things are made of.",
    language: "french",
    topic: "measurements",
    count: 25,
    preview: [
      { term: "le mètre", definition: "metre" },
      { term: "le centimètre", definition: "centimetre" },
      { term: "le kilomètre", definition: "kilometre" },
      { term: "le gramme", definition: "gram" },
      { term: "le kilogramme", definition: "kilogram" },
    ],
  },
  {
    id: "fr-school",
    name: "French — School & Education",
    description: "School life, equipment and every subject.",
    language: "french",
    topic: "school",
    count: 83,
    preview: [
      { term: "l'année scolaire", definition: "school year" },
      { term: "la rentrée scolaire", definition: "start of the school year" },
      { term: "le trimestre", definition: "term" },
      { term: "l'emploi du temps", definition: "timetable" },
      { term: "le programme", definition: "syllabus" },
    ],
  },
  {
    id: "fr-work-careers",
    name: "French — Work & Careers",
    description: "The workplace, job hunting and dozens of jobs.",
    language: "french",
    topic: "work-careers",
    count: 65,
    preview: [
      { term: "le travail", definition: "work" },
      { term: "l'emploi", definition: "employment" },
      { term: "les affaires", definition: "business" },
      { term: "l'entreprise", definition: "company" },
      { term: "l'atelier", definition: "workshop" },
    ],
  },
  {
    id: "fr-culture-festivals",
    name: "French — Culture & Festivals",
    description: "Religion, beliefs and celebrations.",
    language: "french",
    topic: "culture-festivals",
    count: 26,
    preview: [
      { term: "la croyance", definition: "belief" },
      { term: "la foi", definition: "faith" },
      { term: "être croyant", definition: "to be a believer" },
      { term: "être pratiquant", definition: "to be practising" },
      { term: "l'église", definition: "church" },
    ],
  },
  {
    id: "es-adjectives",
    name: "Spanish — Common Adjectives",
    description: "Everyday describing words.",
    language: "spanish",
    topic: "adjectives",
    count: 100,
    preview: [
      { term: "absurdo", definition: "absurd" },
      { term: "aburrido", definition: "boring" },
      { term: "acogedor", definition: "cosy" },
      { term: "agradable", definition: "pleasant" },
      { term: "amigable", definition: "friendly" },
    ],
  },
  {
    id: "es-verbs",
    name: "Spanish — Common Verbs",
    description: "The high-frequency verbs you meet everywhere.",
    language: "spanish",
    topic: "verbs",
    count: 128,
    preview: [
      { term: "ser", definition: "to be" },
      { term: "estar", definition: "to be, temporary" },
      { term: "haber", definition: "to have, auxiliary" },
      { term: "hay", definition: "there is" },
      { term: "tener", definition: "to have" },
    ],
  },
  {
    id: "es-adverbs-prepositions",
    name: "Spanish — Adverbs & Prepositions",
    description: "Words for where, when, how much and how often.",
    language: "spanish",
    topic: "adverbs-prepositions",
    count: 46,
    preview: [
      { term: "a", definition: "to" },
      { term: "de", definition: "of" },
      { term: "en", definition: "in" },
      { term: "con", definition: "with" },
      { term: "sin", definition: "without" },
    ],
  },
  {
    id: "es-numbers",
    name: "Spanish — Numbers",
    description: "Counting, ordinals and quantity words.",
    language: "spanish",
    topic: "numbers",
    count: 63,
    preview: [
      { term: "cero", definition: "zero" },
      { term: "uno", definition: "one" },
      { term: "dos", definition: "two" },
      { term: "tres", definition: "three" },
      { term: "cuatro", definition: "four" },
    ],
  },
  {
    id: "es-time-dates",
    name: "Spanish — Time & Dates",
    description: "Telling the time, days, months and seasons.",
    language: "spanish",
    topic: "time-dates",
    count: 71,
    preview: [
      { term: "la hora", definition: "hour" },
      { term: "el minuto", definition: "minute" },
      { term: "el segundo", definition: "second" },
      { term: "el reloj", definition: "clock" },
      { term: "el momento", definition: "the moment" },
    ],
  },
  {
    id: "es-body-health",
    name: "Spanish — Body & Health",
    description: "Parts of the body, illness and staying well.",
    language: "spanish",
    topic: "body-health",
    count: 58,
    preview: [
      { term: "el cuerpo", definition: "body" },
      { term: "la cabeza", definition: "head" },
      { term: "la cara", definition: "face" },
      { term: "la boca", definition: "mouth" },
      { term: "la nariz", definition: "nose" },
    ],
  },
  {
    id: "es-travel-transport",
    name: "Spanish — Travel & Transport",
    description: "Getting around by road, rail, sea and air.",
    language: "spanish",
    topic: "travel-transport",
    count: 45,
    preview: [
      { term: "el viaje", definition: "trip" },
      { term: "el trayecto", definition: "journey" },
      { term: "ir de viaje", definition: "to go on a trip" },
      { term: "viajar", definition: "to travel" },
      { term: "el coche", definition: "car" },
    ],
  },
  {
    id: "es-food",
    name: "Spanish — Food",
    description: "What's on the plate — from bread to seafood.",
    language: "spanish",
    topic: "food",
    count: 96,
    preview: [
      { term: "el pan", definition: "bread" },
      { term: "la tostada", definition: "toast" },
      { term: "el queso", definition: "cheese" },
      { term: "la mantequilla", definition: "butter" },
      { term: "el huevo", definition: "egg" },
    ],
  },
  {
    id: "es-drink",
    name: "Spanish — Drink & Tableware",
    description: "Drinks, and the cups and cutlery they come with.",
    language: "spanish",
    topic: "drink",
    count: 18,
    preview: [
      { term: "la bebida", definition: "drink" },
      { term: "el agua", definition: "water" },
      { term: "la leche", definition: "milk" },
      { term: "el zumo", definition: "juice" },
      { term: "el café", definition: "coffee" },
    ],
  },
  {
    id: "es-greetings-social",
    name: "Spanish — Greetings & Social",
    description: "Hellos, goodbyes, courtesies and invitations.",
    language: "spanish",
    topic: "greetings-social",
    count: 24,
    preview: [
      { term: "hola", definition: "hello" },
      { term: "buenos días", definition: "good morning" },
      { term: "buenas tardes", definition: "good afternoon" },
      { term: "buenas noches", definition: "good night" },
      { term: "adiós", definition: "goodbye" },
    ],
  },
  {
    id: "es-family",
    name: "Spanish — Family & Relationships",
    description: "Relatives, friends and life events.",
    language: "spanish",
    topic: "family",
    count: 52,
    preview: [
      { term: "la familia", definition: "family" },
      { term: "el pariente", definition: "relative" },
      { term: "familiar", definition: "familiar" },
      { term: "los padres", definition: "parents" },
      { term: "la madre", definition: "mother" },
    ],
  },
  {
    id: "es-describing-people",
    name: "Spanish — Describing People",
    description: "Appearance, character and mood.",
    language: "spanish",
    topic: "describing-people",
    count: 86,
    preview: [
      { term: "la edad", definition: "age" },
      { term: "el sexo", definition: "sex" },
      { term: "la altura", definition: "height" },
      { term: "la talla", definition: "size" },
      { term: "la voz", definition: "voice" },
    ],
  },
  {
    id: "es-home-rooms",
    name: "Spanish — The Home",
    description: "Rooms, furniture and daily routines at home.",
    language: "spanish",
    topic: "home-rooms",
    count: 76,
    preview: [
      { term: "el comedor", definition: "dining room" },
      { term: "el salón", definition: "living room" },
      { term: "la cocina", definition: "kitchen" },
      { term: "el baño", definition: "bathroom" },
      { term: "el estudio", definition: "study" },
    ],
  },
  {
    id: "es-home-appliances",
    name: "Spanish — Household & Chores",
    description: "Appliances, gadgets and keeping house.",
    language: "spanish",
    topic: "home-appliances",
    count: 31,
    preview: [
      { term: "el frigorífico", definition: "fridge" },
      { term: "la nevera", definition: "fridge" },
      { term: "el congelador", definition: "freezer" },
      { term: "el fogón", definition: "cooker" },
      { term: "el horno", definition: "oven" },
    ],
  },
  {
    id: "es-clothes-colours",
    name: "Spanish — Clothes & Colours",
    description: "Garments, accessories and every colour.",
    language: "spanish",
    topic: "clothes-colours",
    count: 72,
    preview: [
      { term: "color", definition: "colour" },
      { term: "blanco", definition: "white" },
      { term: "negro", definition: "black" },
      { term: "rojo", definition: "red" },
      { term: "azul", definition: "blue" },
    ],
  },
  {
    id: "es-hobbies-sport",
    name: "Spanish — Hobbies & Sport",
    description: "Free time, music, games and every sport.",
    language: "spanish",
    topic: "hobbies-sport",
    count: 59,
    preview: [
      { term: "escuchar música", definition: "to listen to music" },
      { term: "ver la tele", definition: "to watch TV" },
      { term: "ir a un concierto", definition: "to go to a concert" },
      { term: "leer un libro", definition: "to read a book" },
      { term: "bailar", definition: "to dance" },
    ],
  },
  {
    id: "es-geography",
    name: "Spanish — Places & Geography",
    description: "Continents, countries and compass points.",
    language: "spanish",
    topic: "geography",
    count: 15,
    preview: [
      { term: "el continente", definition: "continent" },
      { term: "África", definition: "Africa" },
      { term: "América", definition: "America" },
      { term: "Asia", definition: "Asia" },
      { term: "Europa", definition: "Europe" },
    ],
  },
  {
    id: "es-nature-environment",
    name: "Spanish — Nature & Environment",
    description: "Landscape, wildlife and the environment.",
    language: "spanish",
    topic: "nature-environment",
    count: 72,
    preview: [
      { term: "la naturaleza", definition: "nature" },
      { term: "el mundo", definition: "the world" },
      { term: "la tierra", definition: "earth" },
      { term: "el planeta", definition: "planet" },
      { term: "el sol", definition: "sun" },
    ],
  },
  {
    id: "es-weather",
    name: "Spanish — Weather & Climate",
    description: "Describing the weather in every season.",
    language: "spanish",
    topic: "weather",
    count: 18,
    preview: [
      { term: "el tiempo", definition: "weather" },
      { term: "la previsión del tiempo", definition: "weather forecast" },
      { term: "la estación", definition: "season" },
      { term: "los grados", definition: "degrees" },
      { term: "el calor", definition: "heat" },
    ],
  },
  {
    id: "es-technology",
    name: "Spanish — Technology & Media",
    description: "Devices, the internet and things to read.",
    language: "spanish",
    topic: "technology",
    count: 63,
    preview: [
      { term: "el ordenador", definition: "computer" },
      { term: "el portátil", definition: "laptop" },
      { term: "la tableta", definition: "tablet" },
      { term: "el móvil", definition: "mobile" },
      { term: "la pantalla", definition: "screen" },
    ],
  },
  {
    id: "es-town-shopping",
    name: "Spanish — Town & Shopping",
    description: "Around town, and buying and returning things.",
    language: "spanish",
    topic: "town-shopping",
    count: 91,
    preview: [
      { term: "la ciudad", definition: "city" },
      { term: "el pueblo", definition: "town" },
      { term: "el barrio", definition: "neighbourhood" },
      { term: "el edificio", definition: "building" },
      { term: "la casa", definition: "house" },
    ],
  },
  {
    id: "es-measurements",
    name: "Spanish — Measurements & Materials",
    description: "Units, shapes and what things are made of.",
    language: "spanish",
    topic: "measurements",
    count: 21,
    preview: [
      { term: "el grado", definition: "degree" },
      { term: "el gramo", definition: "gram" },
      { term: "el kilogramo", definition: "kilogram" },
      { term: "el kilómetro", definition: "kilometre" },
      { term: "el litro", definition: "litre" },
    ],
  },
  {
    id: "es-school",
    name: "Spanish — School & Education",
    description: "School life, equipment and every subject.",
    language: "spanish",
    topic: "school",
    count: 59,
    preview: [
      { term: "la educación", definition: "education" },
      { term: "el año académico", definition: "academic year" },
      { term: "el curso", definition: "course" },
      { term: "el horario", definition: "timetable" },
      { term: "la clase", definition: "class" },
    ],
  },
  {
    id: "es-work-careers",
    name: "Spanish — Work & Careers",
    description: "The workplace, job hunting and dozens of jobs.",
    language: "spanish",
    topic: "work-careers",
    count: 58,
    preview: [
      { term: "el trabajo", definition: "work" },
      { term: "el empleo", definition: "job" },
      { term: "el negocio", definition: "business" },
      { term: "la empresa", definition: "firm" },
      { term: "la compañía", definition: "company" },
    ],
  },
  {
    id: "es-culture-festivals",
    name: "Spanish — Culture & Festivals",
    description: "Religion, beliefs and celebrations.",
    language: "spanish",
    topic: "culture-festivals",
    count: 21,
    preview: [
      { term: "la celebración", definition: "celebration" },
      { term: "celebrar", definition: "to celebrate" },
      { term: "la fiesta", definition: "party" },
      { term: "el festival", definition: "festival" },
      { term: "la ocasión especial", definition: "special occasion" },
    ],
  },
];
