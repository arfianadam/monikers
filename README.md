# 🃏 Monikers

This is a local, pass-and-play implementation of the party game Monikers. The
interface is written in Bahasa Indonesia and runs entirely in the browser.

## 📝 Description

Monikers is a fun and hilarious party game where players try to guess the names of people, characters, and other pop culture references on cards. The game is played in three rounds, with the same set of cards used in each round. The rules for what you can say to get your team to guess the card change each round, making it progressively more challenging and funny.

This project is a digital version of the game, allowing you to play with friends in person without needing physical cards.

## ✨ Features

- **🎲 Multiple Game Levels:** Includes different card decks for varying difficulty.
- **🔄 Round-based Gameplay:** Supports the classic three-round structure of Monikers.
- **💻 Interactive UI:** Private card selection, timed turns, and round-by-round scoring.
- **🔊 Sound Effects:** Includes sounds for game events.
- **📱 Responsive Play:** Supports phone portrait, short portrait, and landscape layouts.

## 🚀 Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You need to have Node.js and pnpm installed on your machine.

- [Node.js](https://nodejs.org/) v20 or later
- [pnpm](https://pnpm.io/installation) v11.5.2

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/arfianadam/monikers.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd monikers
    ```
3.  Install the dependencies:
    ```bash
    pnpm install --frozen-lockfile
    ```

### Running the Application

To run the application in development mode with Turbopack:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📜 Available Scripts

In the project directory, you can run the following commands:

- `pnpm dev`: Runs the app in development mode.
- `pnpm build`: Builds the app for production.
- `pnpm start`: Starts the production server.
- `pnpm lint`: Lints the repository with ESLint.
- `pnpm lint:fix`: Applies safe ESLint fixes.
- `pnpm format`: Formats the repository with Prettier.
- `pnpm format:check`: Checks formatting without changing files.
- `pnpm typecheck`: Runs strict TypeScript checking.
- `pnpm test`: Runs the Vitest unit suite once.
- `pnpm test:watch`: Runs Vitest in watch mode.
- `pnpm test:e2e`: Builds the app and runs the Playwright flow and visual suite.
- `pnpm test:e2e:update`: Rebuilds intentional Playwright screenshot baselines.
- `pnpm check`: Runs formatting, linting, type checking, and unit tests.

Install Playwright's pinned Chromium browser before the first browser test:

```bash
pnpm exec playwright install chromium
```

## 🛠️ Technologies Used

- [Next.js](https://nextjs.org/) - React Framework
- [React](https://reactjs.org/) - JavaScript Library
- [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript
- [Zustand](https://zustand.docs.pmnd.rs/) - Game State Management
- [CSS Modules](https://nextjs.org/docs/app/getting-started/css) - Component Styles
- [Tailwind CSS](https://tailwindcss.com/) - CSS Foundation and PostCSS Tooling
- [Vitest](https://vitest.dev/) - Unit Tests
- [Playwright](https://playwright.dev/) - Browser and Visual Tests
- [ESLint](https://eslint.org/) - Linter
- [Prettier](https://prettier.io/) - Code Formatter

## 📁 Project Structure

```
.
├── public/
│   ├── sounds/
│   └── *.svg
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── features/game/
│   │   ├── card-selection/
│   │   ├── cards/
│   │   ├── domain/
│   │   ├── score/
│   │   ├── session/
│   │   ├── setup/
│   │   ├── store/
│   │   └── turn/
│   ├── shared/
│   │   ├── hooks/
│   │   └── ui/
│   └── lib/
│       └── utils.ts
├── tests/e2e/
│   ├── __screenshots__/
│   └── game-flow.spec.ts
├── playwright.config.ts
├── vitest.config.ts
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── tsconfig.json
```
