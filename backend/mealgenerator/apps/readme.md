# Project Overview

This is a full-stack application designed for meal planning and nutrition analysis. It consists of a React-based web frontend and a Python FastAPI backend. The application leverages agentic AI, specifically OpenAI's GPT-4o model, to generate personalized meal plans and shopping lists.

**Frontend (web):**

*   **Framework:** React with Vite
*   **Language:** TypeScript
*   **UI:** shadcn-ui and Tailwind CSS
*   **State Management:** Redux Toolkit
*   **Routing:** React Router

**Backend (api):**

*   **Framework:** FastAPI
*   **Language:** Python
*   **AI:** OpenAI GPT-4o for meal planning and shopping list generation.
*   **Database:** Postgre SQL

# Building and Running

## Web (Frontend)

To run the frontend development server:

```bash
cd web
npm install
npm run dev
```

To build the frontend for production:

```bash
cd web
npm install
npm run build
```

## API (Backend)

To run the backend server:

```bash
cd api
pip install -r requirements.txt 
uvicorn app.main:app --reload
```


# Development Conventions

## Frontend

*   The project follows standard React and TypeScript conventions.
*   Components are organized in the `src/components` directory, with UI components from `shadcn-ui` in `src/components/ui`.
*   Pages are located in the `src/pages` directory.
*   State management is handled by Redux Toolkit, with slices defined in `src/store/slices`.
*   Styling is done with Tailwind CSS.

## Backend

*   The backend follows the standard FastAPI project structure.
*   API routes are defined in `api/app/api/v1` and organized by feature.
*   Business logic is separated into services, such as the `MealService` and `ShoppingService`.
*   The application interacts with the OpenAI API for AI-powered features.
*   The project uses a modular design, with clear separation of concerns between the API, core logic, and database layers.


# Application Flow

The application guides the user through a seamless meal planning experience, from onboarding to generating a shopping list.

1.  **Landing Page (`Landing.tsx`):** The user is greeted with a visually appealing page that highlights the application's key features and encourages them to get started.

2.  **Authentication (`Auth.tsx`):** The user can sign up for a new account or log in to an existing one. The application uses a token-based authentication system, with the user's authentication state managed by Redux.

3.  **Onboarding (`Onboarding.tsx`):** After their first login, the user is prompted to provide additional information, such as their location, weight, and height. This information is used to personalize their meal plans.

4.  **Chat (`Chat.tsx`):** The core of the application is a chat-based interface where the user can interact with an AI to generate a meal plan. The user can specify their dietary and culinary preferences, and the AI will generate a meal plan tailored to their needs.

5.  **Calendar (`Calendar.tsx`):** The generated meal plan is displayed in a weekly calendar view. The user can view the details of each meal, generate a shopping list, or download the meal plan as a PDF.

6.  **Meal Details (`MealDetails.tsx`):** When the user clicks on a meal in the calendar, they are taken to a page that displays the meal's ingredients and instructions.

7.  **Shopping List (`ShoppingList.tsx`):** The user can generate a shopping list for the entire week, which is organized by category for convenience.
