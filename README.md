# Scholars' Stash

Scholars' Stash is a curated resource library for homeschooling families. Stephen and Whitney built it to keep track of the educational websites, curricula, videos, and tools they have discovered and want to share with a small community of friends.

## What it does

Members can browse and filter a growing collection of educational resources organized by subject tags and price range. Each resource has a title, description, thumbnail image, and a link to the original site. Logged in members can submit new resources, react to existing ones, and leave comments.

Administrators can review and approve new user registrations, moderate submitted resources, edit resource details including thumbnail images, and manage a suggestions inbox where members can send ideas or feedback directly to the site owners.

Access to the site requires an invitation. New accounts are placed in a pending state until an administrator approves them.

## Technology

**Frontend**

The user interface is a single page application built with React and TypeScript. Tailwind CSS handles styling. Vite is the development server and build tool.

**Backend**

The API is a Node.js server built with Express and TypeScript. Authentication is handled by Passport.js and supports sign in via Google, Facebook, and Discord OAuth. AI powered resource summarization uses the Anthropic API (Claude).

**Database**

PostgreSQL is the database. Drizzle ORM is used for schema management and queries.

**Infrastructure**

The application is containerized with Docker. In production it runs on Railway, which hosts both the API server and the built frontend as a single service alongside a managed PostgreSQL instance. DNS and SSL are managed through Cloudflare.

**Monorepo**

The codebase is organized as a pnpm monorepo with separate packages for the API server, the frontend, the database schema and client, and shared libraries.
