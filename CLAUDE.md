# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

This is a multi-app workspace (no monorepo tooling — each app has its own deps and scripts). Top-level apps:

- [zentra-main/](zentra-main/) — Active Zentra web app. React 19 + Vite + Supabase. Single-page app that renders a phone-shell UI; the legacy Expo/React-Native `zentra-1.0-main` mobile app referenced in older docs has been replaced by this web port.
- [zentra new/](zentra%20new/) — Parallel/newer rewrite using TanStack Start + Cloudflare Workers (`wrangler.jsonc`), shadcn/Tailwind, TanStack Router/Query. File-based routes under [zentra new/src/routes/](zentra%20new/src/routes/). Treat as experimental/in-progress — not wired into `start-dev.ps1`.
- [backend/mealgenerator/](backend/mealgenerator/) — OVIYA full-stack: FastAPI under [apps/api](backend/mealgenerator/apps/api/) and an older Vite/Redux/shadcn web client under [apps/web](backend/mealgenerator/apps/web/) (the web client is legacy; current Zentra UI lives in `zentra-main/`).
- [backend/rag/](backend/rag/) — LangChain + Pinecone + OpenAI RAG. CLI ([main.py](backend/rag/main.py)) for ingest/query, plus a thin FastAPI wrapper in [api.py](backend/rag/api.py) exposing `/health` and `/ask`.
- [model_gateway/](model_gateway/) — FastAPI service that serves per-exercise form-correction inference (bicep curl, squat, deadlift, plank, pushup, dumbbell fly). Models are TensorFlow Keras + MediaPipe pose landmarks; entry is [app/main.py](model_gateway/app/main.py). Per-exercise routes/services are in [app/api/v1/](model_gateway/app/api/v1/) and [app/services/](model_gateway/app/services/).
- [backend/Bicep_Curl_Done/](backend/Bicep_Curl_Done/), `backend/Pushups Inference/`, `backend/Squats Inference/`, etc. — original standalone Python prototypes for each exercise. The reusable inference path is now in `model_gateway/`; do not import these scripts directly (they open the webcam in `__main__` loops).

Two existing docs hold deep context — read them before doing anything non-trivial:
- [REPOSITORY_KNOWLEDGE_BASE.md](REPOSITORY_KNOWLEDGE_BASE.md) — feature/architecture inventory with file-level evidence (note: still references the retired `zentra-1.0-main` mobile app for some screens).
- [ISSUES.md](ISSUES.md) — log of resolved integration bugs and fixes. Append new entries here when fixing cross-service issues.

## Common commands

### Orchestrators (PowerShell, root)

- [start-dev.ps1](start-dev.ps1) — spawns separate PowerShell windows for the meal generator API (port 8000) and the `zentra-main` web app (port 5173). RAG (8001) and model gateway (8010) blocks are commented out — uncomment to start them. Edit `$Root` to match the local path.
- [stop-dev.ps1](stop-dev.ps1) — kills whatever owns ports 8000, 8001, 8002, 8010, 8081.
- [update-env-ip.ps1](update-env-ip.ps1) — detects the active LAN IPv4 and writes `EXPO_PUBLIC_RAG_API_BASE_URL`, `EXPO_PUBLIC_MEAL_GENERATOR_API_BASE_URL`, `EXPO_PUBLIC_MODEL_GATEWAY_API_BASE_URL` into `zentra-main/.env`. The `EXPO_PUBLIC_*` prefix is preserved from the mobile-era and is still read by the web app (see "Env vars" below).

### `zentra-main/` (web app)

```powershell
cd zentra-main
npm run dev          # vite --host 127.0.0.1, port 5173
npm run build
npm run preview
npm run typecheck    # tsc -p tsconfig.web.json --noEmit
```

No lint/test scripts are defined. There is no test runner configured anywhere in this repo.

### `zentra new/` (TanStack Start variant)

```powershell
cd "zentra new"
npm run dev          # or: bun dev
npm run build        # vite build (TanStack Start + Cloudflare adapter)
npm run lint         # eslint .
npm run format       # prettier --write .
```

### `backend/mealgenerator/apps/api/` (FastAPI, port 8000)

```powershell
cd backend\mealgenerator\apps\api
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
python create_db.py            # one-shot: create SQLAlchemy tables
python drop_and_create_db.py   # destructive: drop & recreate
```

Required env vars in `backend/mealgenerator/apps/api/.env`: `SECRET_KEY`, `SQLALCHEMY_DATABASE_URI`, `OPENAI_API_KEY`, `USDA_API_KEY`, `GEMINI_API_KEY`. No Alembic — schema changes are manual via the scripts above.

### `backend/rag/` (FastAPI, port 8001)

```powershell
cd backend\rag
python -m uvicorn api:app --reload --host 0.0.0.0 --port 8001
python main.py                 # interactive CLI: 1=ingest, 2=ask
```

Env vars: `OPENAI_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `PINECONE_REGION`. The QA chain is cached in-process; first request pays the build cost.

### `model_gateway/` (FastAPI, port 8010)

```powershell
cd model_gateway
.\.venv\Scripts\Activate.ps1
$env:MODEL_GATEWAY_LOAD_MODELS_ON_STARTUP = "false"   # optional: skip eager load
python -m uvicorn app.main:app --host 0.0.0.0 --port 8010
python scripts\smoke_test_bicep_curl.py               # synthetic-frame smoke test
```

If a model fails to load on startup, set `MODEL_GATEWAY_LOAD_MODELS_ON_STARTUP=false` and call the per-service `POST /api/v1/<exercise>/load` endpoint to surface the real error. TensorFlow native DLL failures on Windows almost always trace back to missing/old Microsoft Visual C++ Redistributable 2015–2022 x64.

## Architecture notes that aren't obvious from the code

### `zentra-main` is a screen-state SPA, not a router

[zentra-main/src/App.tsx](zentra-main/src/App.tsx) is the entire navigation layer: a single `screen` state, a typed `AppScreen` union, a `Set<AppScreen>` for membership checks, and conditional `{screen === "..." && <Screen .../>}` blocks. `sessionStorage` persists the last screen under `zentra:last-screen`. A `?screen=<name>` query string on first load forces a screen.

To add a screen:
1. Add the literal to `appScreensList` in [App.tsx](zentra-main/src/App.tsx).
2. Export the component from one of [src/screens/auth.tsx](zentra-main/src/screens/auth.tsx), [src/screens/dashboard.tsx](zentra-main/src/screens/dashboard.tsx), or [src/screens/fitness.tsx](zentra-main/src/screens/fitness.tsx) — these are large files, each holding many screens. The barrel [src/screens/index.ts](zentra-main/src/screens/index.ts) re-exports them.
3. Decide whether the screen belongs to a tab (the long ternary that computes `activeTab` in App.tsx).
4. Add the conditional render block.

The `@/*` alias points to `src/*` (see [vite.config.ts](zentra-main/vite.config.ts) and [tsconfig.json](zentra-main/tsconfig.json)). Use it instead of relative paths.

### Env vars: dual `VITE_` / `EXPO_PUBLIC_` prefix

[zentra-main/vite.config.ts](zentra-main/vite.config.ts) sets `envPrefix: ["VITE_", "EXPO_PUBLIC_"]`. Every API URL and Supabase var is read with `VITE_<NAME> ?? EXPO_PUBLIC_<NAME>` (see [src/lib/supabase.ts](zentra-main/src/lib/supabase.ts), [src/lib/api.ts](zentra-main/src/lib/api.ts)). When generating new env vars, follow the same fallback pattern so `update-env-ip.ps1` and existing `.env` files keep working.

### Service base URLs (web → backend)

Defined once in [zentra-main/src/lib/api.ts](zentra-main/src/lib/api.ts):
- `MEAL_API_BASE_URL` → meal generator FastAPI (default `http://localhost:8000`)
- `RAG_API_BASE_URL` → RAG FastAPI (default `http://localhost:8001`)
- `MODEL_GATEWAY_API_BASE_URL` → form-correction FastAPI (default `http://localhost:8010`)

`checkAllServices()` pings each `/health` and feeds the dashboard status indicators.

### Supabase is the source of truth for user data

Mobile-era schema and policies live in [zentra-main/supabase/migrations/](zentra-main/supabase/migrations/) and are still applied to the live Supabase project. Key tables: `user_profiles`, `step_tracking`, `user_steps_history`, `user_logs_history`, `user_meal_history`, `meal_plans`/`meal_plan_items`, `recipes`, `blog_posts`, `saved_blogs`, `ai_chat_conversations`/`ai_chat_messages`, plus the `avatars` storage bucket. RLS scopes rows by `auth.uid() = user_id`. New profile rows are created by the trigger in [20260428192913_create_user_profile_on_signup.sql](zentra-main/supabase/migrations/20260428192913_create_user_profile_on_signup.sql) — do not insert from the client unless that trigger has not run.

`zentra new/` has its own [supabase/](zentra%20new/supabase/) config and migrations folder; the two are independent.

### FastAPI services share patterns but differ in CORS

All three FastAPI apps register CORS with `allow_origins=["*"]`. The meal generator and RAG use `allow_credentials=False`, which is required for `*` to be honoured. [model_gateway/app/main.py](model_gateway/app/main.py) currently uses `allow_credentials=True`; per [ISSUES.md #13](ISSUES.md), this combination has historically caused Starlette to reject WebSocket upgrades with 403. If a websocket from a React/RN client returns 403, flip `allow_credentials` to `False` here rather than narrowing the origin list.

### Form-correction model loading

[model_gateway/app/services/](model_gateway/app/services/) holds one service per exercise. Each loads its own Keras model + sequence-length pickle once and keeps per-session rep-counting state so concurrent clients don't cross-contaminate. Calling `infer.py` from the legacy `backend/<exercise>/` folders directly will open the webcam — always go through the gateway.

### Meal generator API surface

Mounted under `/api/v1` from [backend/mealgenerator/apps/api/app/api/v1/router.py](backend/mealgenerator/apps/api/app/api/v1/router.py). Notable quirks:
- `meal_planning.py` exposes `/generate`, `/generate-daily`, and `/generate-weekly`. The agent emits structured JSON with either `day1` only or `day1`–`day7`; clients (`zentra-main/src/lib/api.ts → parseMealPlan`) normalise both shapes.
- `food_analysis.py` route registration is wrapped in try/except in [main.py](backend/mealgenerator/apps/api/app/main.py) so the API still boots when Torch DLLs fail. The BLIP fallback in `core/food_analysis.py` is commented out — only the Gemini path actually works.
- `auth.py` exposes `/register` and `/login`; `/auth/me` is a placeholder 401 and `/auth/refresh` is missing despite frontend calls. The `app/deps/auth.py` dependency imports symbols (`verify_token`, `repo.get_by_id`) that don't exist — do not wire it into routes without filling in the gaps.

## When making changes

- After resolving any cross-service integration bug, append an entry to [ISSUES.md](ISSUES.md) following the existing `Issue / Fix Applied / Files Involved / Alternatives Not Taken` format.
- The two top-level Markdown docs intentionally include file-path evidence; if you change behaviour they describe (e.g. add a meal endpoint, move a screen, retire `zentra-1.0-main` references), update the relevant section so future agents don't act on stale claims.
