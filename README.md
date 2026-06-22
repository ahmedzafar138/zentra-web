# Zentra Workspace (README)

This repository contains multiple apps and services that form the Zentra project except for the legacy `zentra-main` app (ignored here by request).

**Included in this README**
- Overview of the projects in this workspace
- Quick start and run commands for each service
- Required environment variables
- Useful helper scripts and architecture notes

**Projects (workspace folders)**
- `zentra new/` — New web app (TanStack Start + Vite). Primary UI under development.
- `backend/mealgenerator/` — FastAPI meal-planning API (apps/api).
- `backend/rag/` — Retrieval-Augmented Generation (RAG) service (FastAPI + ingestion CLI).
- `model_gateway/` — FastAPI gateway that hosts form-correction inference (TensorFlow/Keras + MediaPipe).
- Various per-exercise inference prototypes (e.g., `Bicep_Curl_Done/`, `plank/`, `Pushups Inference/`, `Squats Inference/`) kept for reference; use `model_gateway` for production inference access.

Quick Start
-----------
Prerequisites
- Node (16+/18+ recommended) and npm (or bun where indicated)
- Python 3.10+ and `venv`/virtual environment tools
- On Windows, use PowerShell for the bundled scripts

Run the web app (`zentra new`)

```powershell
cd "zentra new"
npm run dev
```

Run the meal generator API (FastAPI)

```powershell
cd backend\mealgenerator\apps\api
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# One-time DB tasks
python create_db.py
# Destructive reset (use carefully)
python drop_and_create_db.py
```

Run the RAG service

```powershell
cd backend\rag
python -m uvicorn api:app --reload --host 0.0.0.0 --port 8001
# Interactive CLI for ingest/query
python main.py
```

Run the model gateway (form-correction)

```powershell
cd model_gateway
# Activate the venv on Windows PowerShell (example)
.\.venv\Scripts\Activate.ps1
# Optionally avoid eager-loading large models at startup
$env:MODEL_GATEWAY_LOAD_MODELS_ON_STARTUP = "false"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8010
# Run smoke tests in scripts/
python scripts\smoke_test_bicep_curl.py
```

Helper orchestrator scripts
- `start-dev.ps1` — spawns development windows for services (meal generator API, `zentra-main` web app by default). Edit the script to enable/disable services.
- `stop-dev.ps1` — kills processes bound to known dev ports.
- `update-env-ip.ps1` — writes local LAN IP addresses into `.env` files used by the frontends and services.

Environment variables (high level)
- Meal generator API (`backend/mealgenerator/apps/api/.env`): `SECRET_KEY`, `SQLALCHEMY_DATABASE_URI`, `OPENAI_API_KEY`, `USDA_API_KEY`, `GEMINI_API_KEY`.
- RAG service: `OPENAI_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `PINECONE_REGION`.
- Model gateway: `MODEL_GATEWAY_LOAD_MODELS_ON_STARTUP` (set `false` to delay heavy loads), plus any model-specific env vars if added.

Architecture notes
- The canonical web UI for the new rewrite lives in `zentra new/` (TanStack Start, file-based routes).
- `supabase/` migrations exist for the project — Supabase is the source of truth for user data.
- `model_gateway` exposes per-exercise inference endpoints; prefer calling the gateway rather than running legacy prototype scripts that open cameras directly.
- RAG caches built indices in-process; the first query may incur an ingestion/build cost.

When making changes
- After fixing cross-service integration bugs, append an entry to `ISSUES.md` documenting the issue and fix.
- Update `REPOSITORY_KNOWLEDGE_BASE.md` if you change behavior described there.

Where to look next
- API routes and FastAPI entry points: `backend/mealgenerator/apps/api/app/` and `backend/rag/api.py`.
- Model gateway entry: `model_gateway/app/main.py` and `model_gateway/app/services/`.
- Frontend app: `zentra new/` (see `package.json`, `src/`, and `wrangler.jsonc` for Cloudflare adapter details).

Contributing
- Fork, make changes in branches, and open a PR with a clear description.
- Keep cross-service changes small and document them in `ISSUES.md`.

License & contact
- This repository does not contain a top-level license file. Add one if needed for your project.
- For questions, check `ISSUES.md` or contact the maintainers listed in project metadata.

---
Generated summary README — edit to add credentials, license, or any project-specific policies.
