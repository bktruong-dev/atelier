# Contributing to Atelier

Thanks for wanting to help. Atelier is a small hobby project, so the process is light.

## Getting started

```bash
npm install
npm run dev
```

`npm run build` type-checks with TypeScript and builds the static site into `dist/`. Please make sure it passes before opening a pull request.

## Ways to help

- **Patterns.** Made something beautiful? Open an issue with its share link or code. Good ones may become reference pages.
- **Bugs.** Describe what you did, what you expected and what happened, plus your browser.
- **Features.** Open an issue first to talk it through, so nobody builds something that won't fit.

## Guidelines

- Keep it lightweight: no UI frameworks, and new runtime dependencies only with a good reason.
- Match the surrounding code style and comment density.
- **Security matters.** Pattern code runs only inside the sandbox worker (`src/sandbox/worker.ts`). Never evaluate user code on the main page, and never insert user text as HTML. If you find a way out of the sandbox, please report it privately instead of in a public issue.

By contributing, you agree that your work is released under the [MIT License](LICENSE).
