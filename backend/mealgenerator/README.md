# 🍽️ OVIYA - AI-Powered Personalized Meal Planning Platform

![OVIYA Banner](https://img.shields.io/badge/OVIYA-AI%20Meal%20Planner-brightgreen?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)

OVIYA is an intelligent, full-stack meal planning application that leverages cutting-edge AI technology to create personalized meal plans, analyze food images, and generate smart shopping lists. Built with modern web technologies and powered by OpenAI GPT-4o and Google Gemini AI models.

## 🌟 Features

### 🤖 AI-Powered Meal Planning
- **Agentic AI Reasoning**: Uses LangChain with OpenAI GPT-4o for intelligent meal plan generation
- **Personalized Recommendations**: Considers BMI, dietary restrictions, culinary preferences, and health goals
- **USDA Database Integration**: Real-time nutritional data validation using USDA FoodData Central API
- **Multi-day Planning**: Generate complete weekly meal plans with macro tracking

### 🍎 Advanced Food Analysis
- **Image Recognition**: Upload food images for instant nutritional analysis
- **Computer Vision**: BLIP model for food identification and description
- **AI-Enhanced Analysis**: Google Gemini 2.5 Flash for intelligent food detection and nutrition estimation
- **Comprehensive Nutrition Data**: Detailed macro and micronutrient breakdown

### 📅 Smart Calendar System
- **Weekly View**: Interactive calendar displaying meal plans with hover details
- **Persistent State**: Meal plans and chat conversations persist across sessions
- **PDF Export**: Download meal plans for offline use
- **Meal Details**: Click-through to detailed meal information and recipes

### 🛒 Intelligent Shopping Lists
- **AI-Generated Lists**: Automatically aggregate ingredients across the entire week
- **Smart Categorization**: Organized by food categories (Proteins, Vegetables, Dairy, etc.)
- **Quantity Optimization**: Intelligent quantity calculations for all meals

### 🔐 Robust Authentication & Security
- **JWT-based Authentication**: Secure token-based authentication system
- **Protected Routes**: Role-based access control for all features
- **Session Management**: Auto-refresh tokens with persistent sessions
- **Secure Password Handling**: BCrypt hashing with secure storage

## 🏗️ Technical Architecture

### Backend (FastAPI)

```
api/
├── app/
│   ├── __pycache__/
│   │   └── main.cpython-311.pyc
│   ├── api/
│   │   └── v1/
│   │       ├── __pycache__/
│   │       ├── auth.py                    # Authentication endpoints
│   │       ├── food_analysis.py           # Food image analysis API
│   │       ├── meal_planning.py           # Meal planning API
│   │       ├── recipe.py                  # Recipe management
│   │       ├── router.py                  # API router configuration
│   │       └── shopping.py                # Shopping list generation
│   ├── core/                              # Core business logic
│   │   ├── __pycache__/
│   │   │   ├── config.cpython-311.pyc
│   │   │   ├── food_analysis.cpython-311.pyc
│   │   │   ├── generate_recipe.cpython-311.pyc
│   │   │   ├── meal_agent.cpython-311.pyc
│   │   │   ├── recipe_utils.cpython-311.pyc
│   │   │   └── security.cpython-311.pyc
│   │   ├── config.py                      # Application configuration
│   │   ├── food_analysis.py               # AI food analysis service
│   │   ├── generate_recipe.py             # Recipe generation logic
│   │   ├── meal_agent.py                  # LangChain agent for meal planning
│   │   ├── recipe_utils.py                # Recipe utilities
│   │   └── security.py                    # JWT and password security
│   ├── db/                                # Database configuration
│   │   ├── __pycache__/
│   │   │   ├── base.cpython-311.pyc
│   │   │   └── base.cpython-312.pyc
│   │   └── base.py
│   ├── deps/                              # Dependency injection
│   │   ├── __pycache__/
│   │   │   ├── __init__.cpython-311.pyc
│   │   │   └── auth.cpython-311.pyc
│   │   ├── __init__.py
│   │   └── auth.py
│   ├── domains/                           # Domain models and services
│   │   ├── meals/                         # Meal domain logic
│   │   │   ├── __pycache__/
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   └── users/                         # User management
│   │       ├── __pycache__/
│   │       ├── models.py
│   │       ├── repo.py
│   │       ├── schemas.py
│   │       └── service.py
│   └── main.py                            # FastAPI application entry point
├── .env                                   # Environment variables
├── .gitignore                             # Git ignore rules
└── create_db.py                           # Database initialization
```

### Frontend (React + TypeScript)

```
web/
├── node_modules/                          # Dependencies
├── public/                                # Static assets
├── src/
│   ├── assets/                            # Media assets
│   │   ├── meal-1.jpg
│   │   ├── meal-2.jpg
│   │   ├── meal-3.jpg
│   │   └── meal-4.jpg
│   ├── components/                        # Reusable UI components
│   │   ├── layout/                        # Layout components
│   │   │   ├── AuthInitializer.tsx        # Authentication initializer
│   │   │   ├── Navbar.tsx                 # Navigation bar
│   │   │   ├── ProtectedRoute.tsx         # Route protection
│   │   │   └── ThemeProvider.tsx          # Theme management
│   │   └── ui/                            # shadcn/ui components
│   │       ├── accordion.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── alert.tsx
│   │       ├── aspect-ratio.tsx
│   │       ├── avatar.tsx
│   │       ├── background-slider.tsx
│   │       ├── badge.tsx
│   │       ├── breadcrumb.tsx
│   │       ├── button.tsx
│   │       ├── calendar.tsx
│   │       ├── card.tsx
│   │       ├── carousel.tsx
│   │       ├── chart.tsx
│   │       ├── checkbox.tsx
│   │       ├── collapsible.tsx
│   │       ├── command.tsx
│   │       ├── context-menu.tsx
│   │       ├── dialog.tsx
│   │       ├── drawer.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── form.tsx
│   │       ├── hover-card.tsx
│   │       ├── input-otp.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── menubar.tsx
│   │       ├── navigation-menu.tsx
│   │       ├── pagination.tsx
│   │       ├── popover.tsx
│   │       ├── progress.tsx
│   │       ├── radio-group.tsx
│   │       ├── resizable.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── sidebar.tsx
│   │       ├── skeleton.tsx
│   │       ├── slider.tsx
│   │       ├── sonner.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       ├── theme-toggle.tsx
│   │       ├── toast.tsx
│   │       ├── toaster.tsx
│   │       ├── toggle-group.tsx
│   │       ├── toggle.tsx
│   │       ├── tooltip.tsx
│   │       └── use-toast.ts
│   ├── hooks/                             # Custom React hooks
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   ├── lib/                               # Utility functions
│   │   ├── api.ts                         # API client
│   │   ├── auth.ts                        # Authentication utilities
│   │   └── utils.ts                       # General utilities
│   ├── pages/                             # Route components
│   │   ├── About.tsx                      # About page
│   │   ├── Auth.tsx                       # Authentication
│   │   ├── Blogs.tsx                      # Blog listings
│   │   ├── Calendar.tsx                   # Meal plan calendar
│   │   ├── Chat.tsx                       # AI meal planning chat
│   │   ├── FoodAnalysis.tsx               # Food image analysis
│   │   ├── Index.tsx                      # Dashboard/Index
│   │   ├── Landing.tsx                    # Landing page
│   │   ├── MealDetails.tsx                # Meal detail view
│   │   ├── MealRecipe.tsx                 # Meal recipe view
│   │   ├── NotFound.tsx                   # 404 page
│   │   ├── Onboarding.tsx                 # User onboarding
│   │   ├── RecipeDetails.tsx              # Recipe details
│   │   └── ShoppingList.tsx               # Shopping list
│   ├── store/                             # Redux state management
│   │   ├── slices/                        # Redux slices
│   │   │   ├── authSlice.ts               # Authentication state
│   │   │   ├── calendarSlice.ts           # Calendar state
│   │   │   ├── chatSlice.ts               # Chat state
│   │   │   ├── mealPlansSlice.ts          # Meal plans state
│   │   │   ├── mealSlice.ts               # Meal state
│   │   │   └── userSlice.ts               # User state
│   │   ├── hooks.ts                       # Redux hooks
│   │   └── store.ts                       # Store configuration
│   ├── App.css                            # App styles
│   ├── App.tsx                            # Main App component
│   ├── index.css                          # Global styles
│   ├── main.tsx                           # Application entry point
│   └── vite-env.d.ts                      # Vite type definitions
├── .env                                   # Environment variables
├── .gitignore                             # Git ignore rules
├── aku.txt                                # Additional file
├── bun.lockb                              # Bun lockfile
├── components.json                        # shadcn/ui configuration
├── eslint.config.js                       # ESLint configuration
├── index.html                             # HTML template
├── package-lock.json                      # npm lockfile
├── package.json                           # Package configuration
├── postcss.config.js                      # PostCSS configuration
├── README.md                              # Project documentation
├── tailwind.config.ts                     # Tailwind configuration
├── tsconfig.app.json                      # TypeScript config (app)
├── tsconfig.json                          # TypeScript configuration
├── tsconfig.node.json                     # TypeScript config (node)
└── vite.config.ts                         # Vite configuration
```

## 🚀 Tech Stack

### Backend Technologies
- **Framework**: FastAPI (Python)
- **AI/ML**: 
  - OpenAI GPT-4o (Meal Planning Agent)
  - Google Gemini 2.5 Flash (Food Analysis)
  - Transformers BLIP (Computer Vision)
  - LangChain (Agent Framework)
- **Database**: SQLAlchemy ORM with PostgreSQL
- **Authentication**: JWT with Jose library
- **External APIs**: USDA FoodData Central API
- **Security**: BCrypt password hashing

### Frontend Technologies
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **State Management**: Redux Toolkit + Redux Persist
- **Routing**: React Router v6
- **HTTP Client**: Fetch API with authentication wrapper
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod validation

### Development Tools
- **Package Manager**: npm/bun
- **Linting**: ESLint + TypeScript ESLint
- **Type Checking**: TypeScript
- **CSS Framework**: Tailwind CSS + PostCSS

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js**: v18+ 
- **Python**: v3.11+
- **PostgreSQL**: v14+
- **API Keys**: OpenAI, Google Gemini, USDA FoodData Central

### Backend Setup

1. **Navigate to API directory**
   ```bash
   cd apps/api
   ```

2. **Install Python dependencies**
   ```bash
   pip install fastapi uvicorn sqlalchemy psycopg2-binary
   pip install python-jose[cryptography] passlib[bcrypt]
   pip install langchain openai requests google-generativeai
   pip install transformers torch pillow pydantic-settings
   ```

3. **Create environment variables**
   ```bash
   # Create .env file
   SECRET_KEY=your_secret_key_here
   SQLALCHEMY_DATABASE_URI=postgresql://user:password@localhost/oviya
   OPENAI_API_KEY=your_openai_api_key
   GEMINI_API_KEY=your_gemini_api_key
   USDA_API_KEY=your_usda_api_key
   ```

4. **Initialize database**
   ```bash
   python create_db.py
   ```

5. **Start the server**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Setup

1. **Navigate to web directory**
   ```bash
   cd apps/web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment variables**
   ```bash
   # Create .env file
   VITE_API_BASE_URL=http://localhost:8000
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 📖 User Journey

### 1. **Landing & Authentication**
- Welcome page with feature highlights
- Secure registration/login system
- JWT token-based authentication

### 2. **User Onboarding**
- Personal information collection (height, weight, goals)
- BMI calculation and health profiling
- Dietary preferences and restrictions setup

### 3. **AI-Powered Chat Interface**
- Natural language meal planning requests
- Real-time AI responses with structured meal plans
- Persistent conversation history

### 4. **Weekly Calendar View**
- Visual meal plan display across 7 days
- Interactive meal details and hover effects
- PDF export functionality

### 5. **Food Analysis**
- Upload food images for instant analysis
- AI-powered food identification and nutrition facts
- Comprehensive macro/micronutrient breakdown

### 6. **Smart Shopping Lists**
- Auto-generated from weekly meal plans
- Categorized ingredient lists
- Optimized quantities for the entire week

## 🤖 AI & Machine Learning Features

### Agentic Meal Planning System
The core AI system uses a sophisticated agentic approach:

```python
# LangChain Agent with USDA API Integration
class MealPlanningAgent:
    - Uses GPT-4o as the reasoning engine
    - USDA database integration for nutrition validation
    - Multi-step reasoning with tool usage
    - Personalized recommendations based on user profile
```

**Agent Workflow**:
1. **Profile Analysis**: Parse user's health metrics and preferences
2. **Meal Brainstorming**: Generate candidate meals using dietary constraints
3. **Nutritional Validation**: Query USDA API for accurate nutrition data
4. **Macro Optimization**: Ensure daily targets are met
5. **Final Selection**: Choose optimal meals for each time slot

### Computer Vision Pipeline
```python
# Multi-model Food Analysis
BLIP Model → Food Description → Gemini AI → Nutrition Analysis
```

1. **Image Processing**: BLIP-2 generates detailed food descriptions
2. **Intelligent Validation**: Gemini AI validates if image contains food
3. **Nutrition Lookup**: AI-powered nutrition estimation
4. **Structured Output**: Formatted nutritional information

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Security**: BCrypt hashing with salt
- **Protected Routes**: Frontend route protection with Redux state
- **Token Refresh**: Automatic token renewal for seamless UX
- **Session Management**: Persistent login state across browser sessions
- **API Security**: Rate limiting and input validation

## 📱 Responsive Design

- **Mobile-First**: Fully responsive design for all screen sizes
- **Progressive Web App**: Works offline with cached data
- **Touch-Friendly**: Optimized for mobile interactions
- **Dark/Light Theme**: System-based theme switching

## 🚀 Deployment

### Backend Deployment
```bash
# Production setup
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Frontend Deployment
```bash
# Build for production
npm run build
# Serve static files (dist/)
```

## 📊 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Token refresh
- `GET /api/v1/auth/me` - Get current user

### Meal Planning
- `POST /api/v1/meal-planning/generate-daily` - Generate daily meal plan
- `POST /api/v1/meal-planning/generate-weekly` - Generate weekly meal plan

### Food Analysis
- `POST /api/v1/food-analysis/analyze-image` - Analyze food image

### Shopping Lists
- `POST /api/v1/shopping_list/generate` - Generate shopping list

### Recipes
- `POST /api/v1/recipe/generate-recipe` - Generate recipe details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- OpenAI for GPT-4o API
- Google for Gemini AI
- USDA for FoodData Central API
- Hugging Face for BLIP models
- shadcn/ui for beautiful UI components
- LangChain for agent framework
