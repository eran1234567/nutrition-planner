# Nutrition Planner

## Overview
A nutrition planning application built with React + Vite + TypeScript. Uses Supabase for backend (auth, database, storage, edge functions). Users can create, import, and manage recipes with AI-powered nutrition calculation.

## Recent Changes
- **2026-02-13**: Optimized image storage — switched from base64-in-database to direct Supabase Storage uploads with client-side compression (max 1200px, JPEG 80% quality). Images now organized by `users/{userId}/recipes/{recipeId}.jpg` path structure.

## Project Architecture
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (Auth, PostgreSQL, Storage, Edge Functions)
- **Image Storage**: Supabase Storage bucket `recipe-images`, organized by user
- **AI**: Edge functions for recipe parsing and nutrition calculation
- **State**: Zustand stores (appStore, mealPlanStore, neutronStore)
- **i18n**: react-i18next for internationalization

## Key Directories
- `src/pages/` — Route pages (CreateRecipe, MyRecipes, Discover, etc.)
- `src/components/` — Reusable UI components
- `src/lib/` — Utility functions (imageUtils, recipeUtils, nutrition, etc.)
- `src/hooks/` — Custom React hooks
- `src/stores/` — Zustand state stores
- `supabase/functions/` — Supabase Edge Functions (Deno)
- `supabase/migrations/` — Database migrations

## Dev Server
- Runs on port 5000, host 0.0.0.0
- `allowedHosts: true` in vite.config.ts for Replit webview

## GitHub
- Connected to: https://github.com/eran1234567/nutrition-planner
