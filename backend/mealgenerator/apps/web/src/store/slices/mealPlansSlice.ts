import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface MealPlanDay {
  [meal: string]: any;
}

interface MealPlansState {
  plans: Array<{ day: number; plan: MealPlanDay }>;
}

const initialState: MealPlansState = {
  plans: [],
};

const mealPlansSlice = createSlice({
  name: "mealPlans",
  initialState,
  reducers: {
    saveMealPlan(
      state,
      action: PayloadAction<{ day: number; plan: MealPlanDay }>
    ) {
      // Replace if day exists, else add
      const idx = state.plans.findIndex((p) => p.day === action.payload.day);
      if (idx !== -1) {
        state.plans[idx] = action.payload;
      } else {
        state.plans.push(action.payload);
      }
    },
    clearMealPlans(state) {
      state.plans = [];
    },
  },
});

export const { saveMealPlan, clearMealPlans } = mealPlansSlice.actions;
export default mealPlansSlice.reducer;
