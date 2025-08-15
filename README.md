<<<<<<< HEAD
# Game Backlog App

A full-stack, self-hostable game backlog tracker built with **Next.js**, **TypeScript**, **Prisma**, **PostgreSQL/Supabase**, **Auth.js**, **Tailwind CSS**, and **shadcn/ui**.

## Goal

Track my video game backlog, rate and tag games, upload covers/screenshots, and discover “similar games” based on my personal library.

---

## Tech Stack

**Frontend & Backend:**  
- [Next.js](https://nextjs.org/) (App Router)  
- [TypeScript](https://www.typescriptlang.org/)  
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)

**Database & ORM:**  
- [PostgreSQL](https://www.postgresql.org/) (hosted on [Supabase](https://supabase.com/))  
- [Prisma](https://www.prisma.io/)

**Auth & File Storage:**  
- [Auth.js (NextAuth)](https://authjs.dev/)  
- Supabase Storage (for covers/screenshots)

**External APIs (Optional):**  
- [IGDB](https://api-docs.igdb.com/) via Twitch API for game metadata import

---

## ✨ Features — v1

- **Backlog management** — Add games, set status (`Wishlist`, `Playing`, `Paused`, `Dropped`, `Finished`), rating, and personal notes.
- **Photos** — Upload covers/screenshots or use placeholder images.
- **Tags & platforms** — Organize games by genre, style, or system.
- **Similar games** — See recommendations based on tag/platform overlap (Jaccard similarity).
- **Filters & sorting** — Search and organize your library.
- **Auth-protected library** — Only you can see/edit your collection.

---

## 🛠️ Out of Scope (for now)

These will be tracked for a later phase:
- Public profiles (`/u/[username]`)
- CSV imports (Steam/Epic/GOG)
- Weekly recap emails
- Embedding-based recommendations
- Play session logs & calendar view
- Smart lists (e.g., Short Games, Co-op, Backlog Busters)

---

## 📂 Project Structure (planned)

app/ # Pages & API routes (Next.js App Router)
layout.tsx
page.tsx # Dashboard
library/
add/
games/[slug]/
settings/
api/
auth/[...nextauth]/
games/search/
games/import/
backlog/
recommendations/
upload/
components/ # UI + forms + layout components
lib/ # Prisma, auth, supabase, utils, recommendations
prisma/ # schema.prisma + migrations + optional seed
styles/ # globals.css + theme tokens
public/ # static assets & placeholders
config/ # site config, navigation, feature flags
types/ # TypeScript types
=======
# Game-Backlog
>>>>>>> bb1281bcaf3aff91cf6f06b7ed96dec58e4e9a82
