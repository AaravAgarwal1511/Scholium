# Scholium
### Learn deeper. Remember longer.

[Live Demo](scholium-home.vercel.app) | [Report Bug](https://github.com/AaravAgarwal1511/Scholium/issues)

## 💡 The Problem

There are many roadblocks that IGCSE students face while studying.
These roadblocks cause students to make decisions and spend more time researching how to solve these problems.

For instance, when a student is told to learn new words in a foreign language, do they...
1. Listen to an audio with the words?
2. Read a dictionary?
3. Use flashcards?

These decisions can cause fatigue that makes studying harder and causes students to procastinate.
As a high school student myself, I have experienced this myself countless times.

## ✨ Our Solution

Scholium aims to solve this issue by filling in the gaps within subjects.
Scholium provides a suite of apps that solves a small, specific issue within each subject?
And the best part: Scholium is completely free and open-source

### Language Hub

Do you struggle with memorizing words for French and Spanish? And even after learning the words, do you find it difficult to recognise them in audio?
Language Hub is a flashcard app where you can choose the words you would like to learn, and the flashcards are generated for you.

After uploading your words, the app generates three types of flashcards: Foreign Lang to English, English to Foreign Lang, and Dictation in the Foreign Lang.
As a result, you can develop the necessary skills for listening, reading, and writing.

[Language Hub](https://language-flash-hub.vercel.app/)

### Poetry Notes

Do you struggle with keeping track of papers of poetry notes, and not having the flexibility of fitting in notes online?
If that is you, Poetry Notes can help you gain that flexibility, without having to manage flying pages.

[Poetry Notes](https://poetrynotes.vercel.app/)

### Recall Master

Do you struggle with memorizing Economics and Physics definitions?
Recall Master can help you memorize these definitions, by taking you through four distinct phases for each definition.

Matching, Multiple Choice, Fill in the Blank, and Complete Recall.
If you're ready to gain those easy two marks in each paper, it's time to look into Recall Master

[Recall Master](https://recall-master-app.vercel.app/)

### Past Papers

Topicals, especially with the necessary mark schemes, are tough to find.
What is more difficult though is finding custom papers.

I've had exams where my teacher gave me three to four completely random chapters.
And you can never find the papers with the perfect combination.

If you struggle with this for subjects such as International and Additional Mathematics, Past Papers may be the app you need.
You are able to choose the specific chapters, and how many questions from that chapter, you would like.

And you're greeted with authentic, past paper questions and a perfect mark scheme.

If you're someone who likes to keep things simple and only wants the topicals...
Past Papers has you covered too.

No login required (only Past Papers).

[Past Papers](https://past-papers-app.vercel.app/)

## 💻 Scholium Was Built With

- The suite is built using React JS in Typescript.
- The suite is maintained using Turborepo.
- The UI is built using Radix UI and Tailwind CSS.
- Icons and Toasts are made using Lucide React and Sonner respectively.
- Forms are handled using Zod.
- Routes are handled and maintained using React Router.

- The SQL Database and Auth is managed with Supabase.
- External Storage (for Poetry Notes) is managed with Supabase.
- External Storage (for Past Papers) is managed with Cloudflare R2.
- Google TTS is used for Lang. Hub Diction Exercises.

A combination of Vitest, Playwright, Storybook, and ESLint is used for testing.

## 🚀 Getting Started

Follow these steps to run the project locally on your machine.

### Prerequisites
- NodeJS v22+
- pnpm 10.26.2
- A Supabase Project
- A Cloudflare R2 Bucket

### Installation
1. Clone the repo: ```bash git clone https://github.com/AaravAgarwal1511/Scholium```
2. Navigate into the directory
3. Install dependencies: "pnpm install"
4. Start the local development server: "pnpm dev"

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/AaravAgarwal1511/Scholium/issues).

## 📄 License
This project is licensed under the MIT License.

