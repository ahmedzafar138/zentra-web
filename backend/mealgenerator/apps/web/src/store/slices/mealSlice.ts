import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Meal {
  id: string;
  name: string;
  ingredients: string[];
  recipe: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface WeeklyMealPlan {
  [day: string]: {
    breakfast: Meal | null;
    lunch: Meal | null;
    dinner: Meal | null;
    snacks: Meal | null;
  };
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface MealState {
  weeklyPlan: WeeklyMealPlan;
  chatHistory: ChatMessage[];
  currentChat: string;
  isGenerating: boolean;
  shoppingList: string[];
}

const initialState: MealState = {
  weeklyPlan: {},
  chatHistory: [],
  currentChat: '',
  isGenerating: false,
  shoppingList: [],
};

const mealSlice = createSlice({
  name: 'meal',
  initialState,
  reducers: {
    setWeeklyPlan: (state, action: PayloadAction<WeeklyMealPlan>) => {
      state.weeklyPlan = action.payload;
    },
    updateMeal: (state, action: PayloadAction<{
      day: string;
      mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
      meal: Meal;
    }>) => {
      const { day, mealType, meal } = action.payload;
      if (!state.weeklyPlan[day]) {
        state.weeklyPlan[day] = {
          breakfast: null,
          lunch: null,
          dinner: null,
          snacks: null,
        };
      }
      state.weeklyPlan[day][mealType] = meal;
    },
    addChatMessage: (state, action: PayloadAction<Omit<ChatMessage, 'id' | 'timestamp'>>) => {
      const newMessage: ChatMessage = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date(),
      };
      state.chatHistory.push(newMessage);
    },
    setCurrentChat: (state, action: PayloadAction<string>) => {
      state.currentChat = action.payload;
    },
    setGenerating: (state, action: PayloadAction<boolean>) => {
      state.isGenerating = action.payload;
    },
    generateShoppingList: (state) => {
      const items: string[] = [];
      Object.values(state.weeklyPlan).forEach(day => {
        Object.values(day).forEach(meal => {
          if (meal?.ingredients) {
            items.push(...meal.ingredients);
          }
        });
      });
      state.shoppingList = [...new Set(items)].sort();
    },
    clearWeek: (state) => {
      state.weeklyPlan = {};
    },
  },
});

export const {
  setWeeklyPlan,
  updateMeal,
  addChatMessage,
  setCurrentChat,
  setGenerating,
  generateShoppingList,
  clearWeek,
} = mealSlice.actions;

export default mealSlice.reducer;