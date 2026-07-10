# 🃏 Monikers

This is a web-based implementation of the party game Monikers, built with Next.js and TypeScript.

## 📝 Description

Monikers is a fun and hilarious party game where players try to guess the names of people, characters, and other pop culture references on cards. The game is played in three rounds, with the same set of cards used in each round. The rules for what you can say to get your team to guess the card change each round, making it progressively more challenging and funny.

This project is a digital version of the game, allowing you to play with friends in person without needing physical cards.

## ✨ Features

- **🎲 Multiple Game Levels:** Includes different card decks for varying difficulty.
- **🔄 Round-based Gameplay:** Supports the classic three-round structure of Monikers.
- **💻 Interactive UI:** Components for game setup, card selection, gameplay, and scoring.
- **🔊 Sound Effects:** Includes sounds for game events.

## 🚀 Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You need to have Node.js and pnpm installed on your machine.

- [Node.js](https://nodejs.org/) (v20 or later recommended)
- [pnpm](https://pnpm.io/installation) (v11)

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
    pnpm install
    ```

### Running the Application

To run the application in development mode with Turbopack:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📜 Available Scripts

In the project directory, you can run the following commands:

- `pnpm dev`: 🏃 Runs the app in development mode.
- `pnpm build`: 📦 Builds the app for production.
- `pnpm start`: 🚀 Starts the production server.
- `pnpm lint`: 🔍 Lints the source code.
- `pnpm lint:fix`: 🛠️ Lints and automatically fixes issues.
- `pnpm format`: 🎨 Formats the code with Prettier.
- `pnpm format:check`: ✅ Checks for formatting issues.
- `pnpm check`: 📋 Runs both linting and format checking.

## 🛠️ Technologies Used

- [Next.js](https://nextjs.org/) - React Framework
- [React](https://reactjs.org/) - JavaScript Library
- [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript
- [Tailwind CSS](https://tailwindcss.com/) - CSS Framework
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
│   ├── components/
│   │   ├── ui/
│   │   ├── CardSelectionScreen.tsx
│   │   ├── GameScreen.tsx
│   │   ├── ScoreScreen.tsx
│   │   └── SetupScreen.tsx
│   ├── data/
│   │   ├── cards-level1.json
│   │   └── ...
│   └── lib/
│       └── utils.ts
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── tsconfig.json
```
