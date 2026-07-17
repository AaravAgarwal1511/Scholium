// Everything you'll want to edit on the About page lives here — AboutPage.tsx
// only decides how it's arranged.

export const PORTRAIT = {
  /**
   * Photos are served from public/, not imported from src/assets, so you can
   * drop the file in without touching the build: save it as
   * apps/scholium-home/public/about-portrait.jpg. Until that file exists the
   * page falls back to the monogram below rather than a broken image.
   */
  src: "/about-portrait.jpg",
  alt: "Aarav Agarwal",
  initials: "AA",
};

export const ABOUT = {
  eyebrow: "About",
  name: "Aarav Agarwal",
  role: "Builder of Scholium",
  /** Doubles as the page's <h1> and its meta description. */
  lede: "Hello! I’m Aarav Agarwal, an IGCSE student with a deep passion for computer science and mathematics.",
  paragraphs: [
    "While studying the Cambridge curriculum, I realized that some of the largest hurdles are not the concepts themselves, but the tools required to apply those concepts in the exam. I built Scholium to bridge that gap – turning my own educational challenges into digital solutions for students.",
    "Scholium started as a personal quest to build tools that improve my own grades, and has now become a full-scale web application. Through the development of Scholium, I’ve been able to obtain a deeper understanding of IGCSE subjects and improve my web development skills.",
  ],
  /** Rendered as `{text} <a href="mailto:…">{email}</a>`. */
  contact: {
    text: "Want to offer any feedback for Scholium? Contact me at",
    email: "aaravagarwal.1511@gmail.com",
  },
};
