from fastapi import APIRouter

from app.api.v1 import bicep_curl, deadlifts, dumbbell_fly, planks, pushups, squats

api_router = APIRouter()
api_router.include_router(bicep_curl.router)
api_router.include_router(squats.router)
api_router.include_router(deadlifts.router)
api_router.include_router(planks.router)
api_router.include_router(pushups.router)
api_router.include_router(dumbbell_fly.router)
