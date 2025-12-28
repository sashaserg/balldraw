# DrawBall 🎨🔮

A real-time collaborative web app where users paint on a 3D sphere to create a New Year toy.

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 9+

### Installation

```bash
# Install pnpm if you don't have it
npm install -g pnpm

# Install dependencies
pnpm install

# Start development (both client and server)
pnpm dev
```

### URLs
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

## Controls

| Action | Control |
|--------|---------|
| Paint | Left-click + drag |
| Rotate | Right-click + drag |
| Toggle Paint/Erase | Middle-click |
| Zoom | Scroll wheel |

## Project Structure

```
drawball/
├── packages/
│   ├── client/     # React + Three.js frontend
│   ├── server/     # Express + Socket.IO backend
│   └── shared/     # Shared TypeScript types
```

## Tech Stack

- **Frontend**: React, React Three Fiber, Zustand, Vite
- **Backend**: Express, Socket.IO

- **Language**: TypeScript
- **Monorepo**: pnpm workspaces + Turborepo
