# Contributing to aads

Thank you for your interest in contributing to aads!

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) (recommended) or npm

### Getting Started

```bash
# Clone the repository
git clone https://github.com/yuuki-courage/aads.git
cd aads

# Install dependencies
pnpm install

# Run in development mode
pnpm dev --help

# Type check
pnpm typecheck

# Run tests
pnpm test

# Lint
pnpm lint

# Format check
pnpm format:check
```

### Project Structure

```
src/
├── cli.ts              # CLI entry point (5 commands)
├── config/             # Configuration and constants
├── core/               # Header mapping and data normalization
├── io/                 # Excel/CSV reader and writer
├── analysis/           # Performance analysis modules
├── pipeline/           # Analysis pipeline and types
├── ranking/            # SEO ranking integration
└── utils/              # Logger and date utilities
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Ensure all checks pass:
   ```bash
   pnpm typecheck && pnpm test && pnpm lint
   ```
5. Commit with a descriptive message
6. Push and open a Pull Request

## Coding Guidelines

- TypeScript strict mode is enabled
- Follow existing code style (Prettier enforced)
- Keep functions small and focused
- Add tests for new analysis logic

## Reporting Issues

Please use [GitHub Issues](https://github.com/yuuki-courage/aads/issues) to report bugs or suggest features.
