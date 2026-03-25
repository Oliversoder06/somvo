# Somvo – Graphic Design Manual

> This document is the single source of truth for all frontend visual decisions. Copilot must reference this before writing any UI code. Every component, page, and interaction must conform to this system.

---

## 1. Brand Philosophy

Somvo sits in the moment between raw footage and finished video — the shadow before the reveal. The visual language reflects this: dark, precise, controlled tension. It is not a playful consumer app. It is not a clinical SaaS dashboard. It is a **focused creative tool** that feels like it was built for people who take their content seriously.

The aesthetic is **dark cinematic SaaS** — the look of a high-end post-production suite crossed with a well-designed developer tool. Think Cardboard's cinematic depth meets a film editing terminal. Floating UI elements with layered depth through shadow and contrast, never glassmorphism. Dense with information but never chaotic. Every pixel is intentional.

---

## 2. Colour System

All colours are defined as CSS custom properties on `:root`. Never hardcode hex values in components.

```css
:root {
  /* Backgrounds */
  --bg-base: #080809; /* Page background — deeper near-black, slightly cool */
  --bg-surface: #0e0e10; /* Cards, panels */
  --bg-elevated: #161618; /* Hover states, nested panels */
  --bg-border: #1f1f23; /* Dividers, borders — more subtle */

  /* Primary accent — Ice Blue */
  --accent: #e2e8f0; /* Near-white, clean, premium */
  --accent-dim: #e2e8f010; /* Accent background wash */
  --accent-hover: #cbd5e1; /* Slightly dimmer on hover */

  /* Text */
  --text-primary: #f8f8f8; /* Headings — brighter, no warmth */
  --text-secondary: #71717a; /* Subtext, descriptions */
  --text-muted: #3f3f46; /* Placeholders, disabled */

  /* Semantic */
  --success: #3ecf8e; /* Approved steps, export complete */
  --danger: #e5484d; /* Rejected steps, errors */
  --info: #60a5fa; /* Processing states, info badges */

  /* Timeline specific */
  --timeline-raw: #18181b; /* Raw track background */
  --timeline-edit: #141416; /* Edit track background */
  --timeline-cut: #e5484d33; /* Cut region overlay */
  --timeline-cap: #e2e8f033; /* Caption marker */
  --waveform: #27272a; /* Inactive waveform */
  --waveform-act: #e2e8f0; /* Active/playhead waveform */
}
```

**Rules:**

- Background hierarchy: `--bg-base` → `--bg-surface` → `--bg-elevated`. Never invert this.
- Accent is near-white, signalling clarity and precision. It is reserved for one primary action per view only.
- No warm tones anywhere. The palette is cool-neutral.
- No pure white (`#ffffff`) anywhere. Use `--text-primary` for the brightest text.
- Transparency is preferred over new colours. Use `--accent` at reduced opacity before inventing a new colour.

---

## 3. Typography

Fonts are loaded via `next/font/google` in `app/layout.tsx`. The CSS variables are set automatically by Next.js.

```tsx
import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

```css
:root {
  --font-display: "Geist", sans-serif; /* Headings, labels, nav */
  --font-body: "Geist", sans-serif; /* Body copy, descriptions */
  --font-mono: "Geist Mono", monospace; /* Timestamps, code, agent reasoning */
}
```

### Type Scale

| Token         | Font       | Size             | Weight  | Use                            |
| ------------- | ---------- | ---------------- | ------- | ------------------------------ |
| `--text-2xl`  | Geist      | 2.25rem / 36px   | 700     | Page titles                    |
| `--text-xl`   | Geist      | 1.625rem / 26px  | 600     | Section headings               |
| `--text-lg`   | Geist      | 1.125rem / 18px  | 500     | Card titles, panel headers     |
| `--text-base` | Geist      | 0.9375rem / 15px | 400     | Body copy                      |
| `--text-sm`   | Geist      | 0.8125rem / 13px | 400     | Labels, secondary text         |
| `--text-xs`   | Geist Mono | 0.75rem / 12px   | 400/500 | Timestamps, metadata, step IDs |

**Rules:**

- Both display and body use Geist — unified, clean, modern.
- Geist Mono replaces IBM Plex Mono for timestamps and metadata.
- Use `--font-display` for anything the user reads as a label or heading.
- Use `--font-mono` for any time-related value, step index, file size, or agent output. This signals machine precision.
- Line-height: `1.5` for body, `1.2` for headings, `1.6` for agent reasoning text.
- Letter-spacing: `-0.03em` on display headings size `--text-xl` and above.
- No `text-transform: uppercase` on display headings. Badges and step type labels remain uppercase.

---

## 4. Spacing System

Based on a 4px base unit.

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

**Rules:**

- Component internal padding: `--space-4` to `--space-6`
- Section gaps: `--space-8` to `--space-12`
- Page-level padding: `--space-8` horizontal on desktop, `--space-4` on mobile
- Never use arbitrary pixel values. Map to the closest token.

---

## 5. Layout

### App Shell

```
┌─────────────────────────────────────────────────────┐
│  Topbar (56px fixed)                                │
├─────────────┬───────────────────────────────────────┤
│             │                                       │
│  Sidebar    │   Main Content Area                   │
│  (240px)    │                                       │
│             │                                       │
└─────────────┴───────────────────────────────────────┘
```

- **Topbar:** 56px tall. Contains logo (left), project name (centre, optional), user avatar + plan badge (right). `background: --bg-surface`. `border-bottom: 1px solid --bg-border`.
- **Sidebar:** 240px fixed. `background: --bg-surface`. Contains nav links. Collapsed to 56px icon-only on smaller viewports.
- **Main area:** Scrollable. `background: --bg-base`. Max content width `1200px`, centred.

### Editor Layout (Project Page)

```
┌──────────────────────────────────────────────────────────┐
│  Topbar                                                  │
├───────────────────────┬──────────────────────────────────┤
│                       │                                  │
│   Video Preview       │   Agent Reasoning Panel          │
│   (16:9, centred)     │   (approve / reject steps)       │
│                       │                                  │
├───────────────────────┴──────────────────────────────────┤
│                                                          │
│   Dual Timeline (Peaks.js)                               │
│   Raw track ──────────────────────────────────────────   │
│   Edit track ──────────────────────────────────────────  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- Preview panel: left 60% of content area
- Agent panel: right 40%, scrollable
- Timeline: full width, 160px tall minimum. Fixed to bottom of editor view.

---

## 6. Components

### Buttons

```css
/* Primary */
.btn-primary {
  background: var(--text-primary);
  color: #080809;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-transform: none;
  padding: 10px 20px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast);
}
.btn-primary:hover {
  background: var(--accent-hover);
}
.btn-primary:active {
  transform: scale(0.98);
}

/* Secondary */
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--bg-border);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  padding: 10px 20px;
}
.btn-secondary:hover {
  background: var(--bg-elevated);
  border-color: var(--text-muted);
}

/* Ghost / Destructive */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
}
.btn-danger {
  background: var(--danger);
  color: #fff;
  border: none;
}
```

**Rules:**

- One `btn-primary` per page/view maximum.
- Primary button is white on dark — high contrast, clean.
- No `text-transform: uppercase` on buttons.
- Buttons never have box shadows. Depth is handled by background contrast only.
- Icon buttons (icon only, no text) are 36×36px, `border-radius: 6px`.

---

### Cards & Panels

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: 10px;
  padding: var(--space-6);
}

.panel {
  background: var(--bg-surface);
  border-left: 1px solid var(--bg-border); /* for side panels */
  padding: var(--space-6);
}
```

- No box shadows on regular cards. Border is the only separation.
- Hover state on clickable cards: `border-color: var(--text-muted); background: var(--bg-elevated)`.
- `border-radius: 10px` on standalone cards. `border-radius: 6px` on nested elements inside cards.
- **Exception:** Floating product preview cards may use a subtle box-shadow for depth:
  `box-shadow: 0 0 0 1px var(--bg-border), 0 24px 48px rgba(0,0,0,0.6);`
  This is the only permitted use of box-shadow in the system.

---

### Status Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border-radius: 4px;
}

.badge-processing {
  background: #60a5fa22;
  color: var(--info);
}
.badge-ready {
  background: #3ecf8e22;
  color: var(--success);
}
.badge-failed {
  background: #e5484d22;
  color: var(--danger);
}
.badge-free {
  background: #e2e8f022;
  color: var(--accent);
}
.badge-creator {
  background: #3ecf8e22;
  color: var(--success);
}
.badge-pro {
  background: #a78bfa22;
  color: #a78bfa;
}
```

Each badge includes a 6px dot before the label:

```html
<span class="badge badge-processing">
  <span
    style="width:6px;height:6px;border-radius:50%;background:currentColor"
  ></span>
  Processing
</span>
```

---

### Agent Step Item

The core UI unit of the product. Each proposed edit step from the agent.

```
┌──────────────────────────────────────────────────────────┐
│  ○  01   Cut silence           00:14.2 – 00:17.8         │
│         Removes 3.6s of silence between sentences.       │
│                              [ Reject ]  [ ✓ Approve ]   │
└──────────────────────────────────────────────────────────┘
```

- Step index: `--font-mono`, `--text-muted`
- Step type: `--font-display`, `font-weight: 600`, `--text-primary` (no uppercase — prominence via weight only)
- Timestamp range: `--font-mono`, `--text-secondary`
- Reason text: `--font-body`, `--text-secondary`, size `--text-sm`
- Approved state: left border `3px solid --success`, background `rgba(62,207,142,0.04)`
- Rejected state: left border `3px solid --danger`, opacity `0.35` on entire card
- Pending state: left border `3px solid --bg-border`

---

### Timeline

- Background: `--timeline-raw` and `--timeline-edit` for respective tracks
- Track label: left-aligned, `--font-mono`, 11px, `--text-muted`
- Playhead: 1px wide, `--waveform-act`, full track height, with a small triangle handle at top
- Cut regions: `--timeline-cut` overlay
- Caption ticks: 2px wide, `--timeline-cap`, full track height
- Waveform colour: `--waveform` inactive, `--waveform-act` for played portion

---

### Form Inputs

```css
.input {
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: 6px;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 14px;
  padding: 10px 14px;
  width: 100%;
  outline: none;
  transition: border-color 120ms ease;
}
.input::placeholder {
  color: var(--text-muted);
}
.input:focus {
  border-color: var(--accent);
}
```

- Labels: `--font-display`, 12px, uppercase, `letter-spacing: 0.06em`, `--text-secondary`
- Error state: `border-color: var(--danger)`, small error message below in `--danger` at 13px
- No label animation/floating labels. Static labels above the input only.

---

### Upload Zone

```css
.upload-zone {
  border: 1.5px dashed var(--bg-border);
  border-radius: 12px;
  padding: var(--space-16) var(--space-8);
  text-align: center;
  cursor: pointer;
  transition:
    border-color 150ms ease,
    background 150ms ease;
}
.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--text-muted);
  background: var(--bg-elevated);
}
```

- Icon: a simple upload icon, `--text-muted`, 32px
- Headline: `--font-display`, `--text-primary`, 16px
- Subtext: `--font-body`, `--text-secondary`, 13px — accepted formats and size limit

---

## 7. Iconography

Use **Lucide React** exclusively. No other icon sets.

```tsx
import {
  Upload,
  Check,
  X,
  Play,
  Pause,
  Download,
  Scissors,
  Clock,
  ChevronRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
```

**Rules:**

- Default icon size: `16px` (inline with text), `20px` (standalone actions), `24px` (empty states)
- Stroke width: `1.5` always
- Icons never receive `--accent` colour unless they are the sole indicator of an active state
- Animated spinner: `<Loader2>` with `animate-spin` class

---

## 8. Motion & Animation

```css
/* Transitions — always use these durations */
--transition-fast: 80ms ease; /* Button press, toggle */
--transition-base: 150ms ease; /* Hover states, colour changes */
--transition-slow: 250ms ease; /* Panel open/close, page elements */

/* Entrance animation */
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.fade-up {
  animation: fadeUp 200ms ease forwards;
}
```

**Rules:**

- Agent steps animate in with `fadeUp` staggered at `40ms` per step when the step list loads.
- No spring physics or bounce. Easing is always `ease` or `ease-out`.
- No parallax. No scroll-triggered animations. Keep it focused.
- Loading states: `Loader2` icon spinning + text label. Never skeleton screens for the MVP.

---

## 9. Navigation

### Sidebar Links

```
─ Dashboard
─ Projects
─ Usage
─ Settings
```

- Active link: left border `2px solid --text-muted`, background `--bg-elevated`, text `--text-primary`
- Inactive link: no border, text `--text-secondary`
- Link font: `--font-display`, 13px, `font-weight: 500`
- Icon + label. Icon is `16px` Lucide, `stroke-width: 1.5`
- Reserve `--accent` (near-white) as a highlight only — not for nav active states.

### Topbar

- Logo: wordmark `SOMVO` in `--font-display`, `font-weight: 700`, `--text-primary`, `letter-spacing: -0.04em`. No logomark for MVP.
- Right side: avatar circle (initials, `--bg-elevated` background) + plan badge

---

## 10. Empty & Loading States

### Empty States

Each empty state has: icon (24px, `--text-muted`), headline (`--font-display`, `--text-primary`), sub-copy (`--font-body`, `--text-secondary`), one CTA button (`btn-primary`).

- No illustrations. Icon only.
- Centre-aligned, max-width 320px.

### Loading States

- Full-page loading: centred `Loader2` spinning, `--text-muted`
- Button loading: replace label with `<Loader2 size={14} className="animate-spin" />` + disable button
- Pipeline processing: status badge (`badge-processing`) + progress message in `--font-mono`

---

## 11. Responsive Behaviour

MVP targets **desktop first** (1280px+). Minimum supported width is **768px (tablet)**.

| Breakpoint    | Behaviour                                                       |
| ------------- | --------------------------------------------------------------- |
| `≥ 1280px`    | Full layout: sidebar + preview + agent panel + timeline         |
| `1024–1279px` | Agent panel collapses below preview. Timeline stays full width. |
| `768–1023px`  | Sidebar collapses to icon-only (56px). Single column editor.    |
| `< 768px`     | Out of scope for v1. Show "best on desktop" message.            |

---

## 12. globals.css

Modern Next.js (App Router) does not use a `tailwind.config.js`. All design tokens live in `app/globals.css`. This is the complete file — copy it verbatim and do not split tokens across other files.

```css
/* app/globals.css */

@import url("https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Geist:wght@400;500;600;700;800&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

/* ─── Design Tokens ──────────────────────────────────────── */

:root {
  /* Backgrounds */
  --bg-base: #080809;
  --bg-surface: #0e0e10;
  --bg-elevated: #161618;
  --bg-border: #1f1f23;

  /* Primary accent — Ice Blue */
  --accent: #e2e8f0;
  --accent-dim: #e2e8f010;
  --accent-hover: #cbd5e1;

  /* Text */
  --text-primary: #f8f8f8;
  --text-secondary: #71717a;
  --text-muted: #3f3f46;

  /* Semantic */
  --success: #3ecf8e;
  --danger: #e5484d;
  --info: #60a5fa;

  /* Timeline */
  --timeline-raw: #18181b;
  --timeline-edit: #141416;
  --timeline-cut: #e5484d33;
  --timeline-cap: #e2e8f033;
  --waveform: #27272a;
  --waveform-act: #e2e8f0;

  /* Typography */
  --font-display: "Geist", sans-serif;
  --font-body: "Geist", sans-serif;
  --font-mono: "Geist Mono", monospace;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Transitions */
  --transition-fast: 80ms ease;
  --transition-base: 150ms ease;
  --transition-slow: 250ms ease;
}

/* ─── Base Reset ─────────────────────────────────────────── */

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  background-color: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* ─── Animations ─────────────────────────────────────────── */

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

.fade-up {
animation: fadeUp 200ms ease forwards;
}

.animate-spin {
animation: spin 700ms linear infinite;
}

```

**Rules:**

- All CSS variables are defined here and nowhere else.
- Tailwind utility classes are used for layout and spacing where convenient, but always reference `var(--token)` for colours and fonts — never raw hex values in component files.
- Do not add a `tailwind.config.js` or `tailwind.config.ts`. Tailwind v4 (used in current Next.js) is configured via CSS only.
- Fonts are loaded via `next/font/google` in `app/layout.tsx` using Geist and Geist Mono.

---

## 13. Do / Don't

| ✅ Do                                                  | ❌ Don't                                                |
| ------------------------------------------------------ | ------------------------------------------------------- |
| Use Geist and Geist Mono exclusively                   | Use Syne, Inter, IBM Plex Mono, or any other fonts      |
| Keep backgrounds in the `--bg-*` hierarchy (cool-neutral) | Introduce warm tones or amber anywhere                  |
| Use near-white primary button on dark backgrounds      | Use accent colour as a button background                |
| Use `--font-mono` for all timestamps and metadata      | Use body font for timestamps or machine output          |
| Keep `--accent` for one primary action per view        | Use accent decoratively or on multiple elements         |
| Use borders for depth and separation                   | Use box shadows on regular cards or panels              |
| Use box-shadow only on floating product preview cards  | Add box-shadow to anything else                         |
| Label badge and step types in uppercase monospace      | Uppercase display headings or button labels             |
| Use `--text-muted` border for active sidebar links     | Use accent colour on nav active states                  |
| Animate step list entrance with `fadeUp` stagger       | Add bounce, spring, or scroll-triggered animations      |
| Use Lucide icons at `stroke-width: 1.5`               | Mix icon libraries or use filled icons                  |
| One primary CTA per view                               | Stack multiple `btn-primary` buttons together           |
| Static labels above inputs                             | Float or animate labels inside inputs                   |
```
