from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
import logging
import time

import warnings
from langchain_core._api import LangChainDeprecationWarning
warnings.filterwarnings("ignore", category=LangChainDeprecationWarning)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_app() -> FastAPI:
    app = FastAPI(title=settings.PROJECT_NAME)
    
    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        logger.info("=" * 70)
        logger.info(f"🌐 Incoming Request: {request.method} {request.url.path}")
        logger.info(f"📍 Full URL: {request.url}")
        logger.info(f"🔑 Headers: {dict(request.headers)}")
        logger.info(f"🌍 Client: {request.client.host if request.client else 'Unknown'}")
        logger.info("=" * 70)
        
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        
        logger.info(f"✅ Response Status: {response.status_code}")
        logger.info(f"⏱️  Process Time: {process_time:.3f}s")
        logger.info("=" * 70)
        
        return response
    
    # Configure CORS to allow all origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    app.include_router(api_router, prefix=settings.API_V1_STR)
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        logger.info("🏥 Health check endpoint hit")
        return {"status": "healthy", "message": "Backend is running!"}
    
    @app.get("/")
    async def root():
        logger.info("🏠 Root endpoint hit")
        return {"message": "OVIYA API is running", "docs": "/docs"}
    
    # Initialize meal planning agent on startup
    @app.on_event("startup")
    async def startup_event():
        try:
            from app.core.meal_agent import get_meal_agent
            get_meal_agent()  # Initialize the agent
            print("Agent Started!")
        except Exception as e:
            print(f"Error initializing meal planning agent: {e}")

        # Initialize food analysis service only when optional ML deps are healthy.
        try:
            from app.core.food_analysis import get_food_analysis_service
            get_food_analysis_service()
            print("Food Analysis Service Started!")
        except Exception as e:
            print(f"Food Analysis Service disabled: {e}")
            
    return app

app = create_app()
