# Demo App Web

React frontend for the demo application. Displays PR environment information with an animated UI.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Development](#development)
- [Testing](#testing)
- [Build](#build)
- [Styling](#styling)

## Overview

The web app is a single-page application (SPA) built with React 19 and Vite. It fetches PR metadata from the API and displays it with an animated interface.

## Features

### PR Information Display

- **PR Number** - Prominently displayed in hero section
- **Branch Name** - Current Git branch
- **Commit SHA** - Short commit hash (monospace)
- **Version** - Application version
- **Preview URL** - Clickable link to the environment

### Visual Elements

- Animated gradient background
- Floating orb animations (4 orbs)
- Particle system (20 particles)
- "Live" status badge with pulse animation
- Pipeline visualization showing deployment steps
- Tech stack badges (k3s, Helm, GitHub Actions, Traefik)

### States

- **Loading** - Spinner while fetching data
- **Connected** - Displays PR information
- **Error** - Shows connection error message

## Development

### Running Locally

```bash
cd demo-app

# Start development server
pnpm dev:web

# Or from apps/web
cd apps/web
pnpm dev
```

The development server runs on `http://localhost:5173`.

### API Proxy

In development, Vite proxies `/api` requests to `http://localhost:3000`:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```

Run the API separately:
```bash
pnpm dev:api
```

### Hot Module Replacement

Vite provides HMR for instant updates during development.

## Testing

Tests use Vitest with React Testing Library in a jsdom environment.

```bash
# Run tests
pnpm --filter @demo-app/web test

# Watch mode
pnpm --filter @demo-app/web test:watch

# Coverage report
pnpm --filter @demo-app/web test:cov
```

### Test Files

- `App.spec.tsx` - Component tests

### Test Setup

Tests are configured in `src/test/setup.ts`:
- Imports `@testing-library/jest-dom` matchers
- Configures jsdom environment

### Coverage Threshold

Minimum 50% coverage required for:
- Lines
- Functions
- Branches
- Statements

## Build

### Production Build

```bash
pnpm build:web
```

Output is written to `apps/web/dist/`.

### Build Process

1. TypeScript compilation (`tsc -b`)
2. Vite production build
3. Assets optimized and bundled

### Output Structure

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── vite.svg
```

### Deployment

The build output is copied to the API's `public/` directory during Docker build. The NestJS API serves these static files.

## Styling

### Approach

All styles are in a single CSS file (`App.css`) with:
- CSS custom properties for theming
- Keyframe animations
- Responsive design
- Dark theme by default

### Animations

| Animation | Description |
|-----------|-------------|
| `gradient` | Background gradient animation |
| `float` | Floating orb movement |
| `particle` | Particle system movement |
| `pulse` | Live badge pulse effect |
| `fadeIn` | Content fade-in on load |
| `slideUp` | Cards slide-up effect |

### Color Scheme

- Primary: Purple/violet gradients
- Background: Dark with gradient overlay
- Text: White with opacity variations
- Accents: Cyan, purple, pink

### Responsive Design

The layout adapts to different screen sizes:
- Cards grid: 1-4 columns based on width
- Font sizes scale appropriately
- Animations simplified on mobile

## TypeScript Configuration

Strict mode is enabled with additional checks:
- `noUnusedLocals`
- `noUnusedParameters`
- `noFallthroughCasesInSwitch`
- `noUncheckedSideEffectImports`

Target: ES2022 with ESNext modules.
