# Near Me

Near Me is a React + Vite frontend for browsing local service providers, viewing provider profiles, and exploring nearby providers on a map.

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- React Router
- React Leaflet / OpenStreetMap

## Project Structure

```txt
NearMe/
  frontend/   React + Vite app
  backend/    Backend placeholder
```

## Prerequisites

- Node.js 18 or newer
- npm

Check your installed versions:

```bash
node -v
npm -v
```

## Step-by-Step Setup

From the repository root:

### 1. Go to the frontend folder

```bash
cd frontend
```

### 2. Install all dependencies

This installs everything listed in `frontend/package.json`.

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

Open the local URL shown in the terminal. By default, Vite uses:

```txt
http://127.0.0.1:5173
```

### 4. Build for production

```bash
npm run build
```

The production files will be generated in:

```txt
frontend/dist
```

### 5. Preview the production build

```bash
npm run preview
```

## Dependencies

You normally only need to run:

```bash
npm install
```

That command installs the dependencies below.

Main app dependencies:

```bash
npm install react react-dom react-router-dom vite
npm install tailwindcss postcss autoprefixer tailwindcss-animate
npm install lucide-react
npm install leaflet react-leaflet
npm install @tanstack/react-query axios
npm install class-variance-authority clsx tailwind-merge
npm install @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-aspect-ratio
npm install @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-collapsible
npm install @radix-ui/react-context-menu @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @radix-ui/react-hover-card @radix-ui/react-label @radix-ui/react-menubar
npm install @radix-ui/react-navigation-menu @radix-ui/react-popover @radix-ui/react-progress
npm install @radix-ui/react-radio-group @radix-ui/react-scroll-area @radix-ui/react-select
npm install @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-slot
npm install @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-toast
npm install @radix-ui/react-toggle @radix-ui/react-toggle-group @radix-ui/react-tooltip
```

Other installed libraries used or available in the project:

```bash
npm install framer-motion sonner react-hot-toast recharts date-fns moment lodash zod
npm install react-hook-form @hookform/resolvers cmdk vaul embla-carousel-react
npm install react-day-picker react-resizable-panels input-otp next-themes
npm install canvas-confetti html2canvas jspdf three react-markdown react-quill
npm install @stripe/react-stripe-js @stripe/stripe-js @hello-pangea/dnd
```

Development dependencies:

```bash
npm install -D @vitejs/plugin-react eslint @eslint/js eslint-plugin-react
npm install -D eslint-plugin-react-hooks eslint-plugin-react-refresh eslint-plugin-unused-imports
npm install -D globals typescript @types/node @types/react @types/react-dom
```

Again, these manual commands are only for reference. For a fresh clone, prefer:

```bash
cd frontend
npm install
```

## Available Scripts

Run these inside `frontend/`.

```bash
npm run dev
```
Run these inside `backend/`.

```bash
npm install -g nodemon
npm install express --save
```


Starts the development server.

```bash
npm run build
```


Previews the production build locally.

```bash
npm run lint
```

## Map / Location

The Find Services page uses OpenStreetMap through React Leaflet. The browser may ask for location permission. If permission is denied, the app falls back to a demo Manila location.
