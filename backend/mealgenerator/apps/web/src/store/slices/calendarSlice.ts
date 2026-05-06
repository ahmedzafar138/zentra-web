import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface MealData {
  [dateKey: string]: {
    [mealType: string]: string;
  };
}

interface CalendarState {
  mealData: MealData;
  startDate: string; // ISO string for persistence
}

const initialState: CalendarState = {
  mealData: {},
  startDate: new Date().toISOString(),
};

const calendarSlice = createSlice({
  name: "calendar",
  initialState,
  reducers: {
    setMealData: (state, action: PayloadAction<MealData>) => {
      state.mealData = action.payload;
    },
    updateMealData: (
      state,
      action: PayloadAction<{ dateKey: string; mealType: string; food: string }>
    ) => {
      const { dateKey, mealType, food } = action.payload;
      if (!state.mealData[dateKey]) {
        state.mealData[dateKey] = {};
      }
      state.mealData[dateKey][mealType] = food;
    },
    setStartDate: (state, action: PayloadAction<string>) => {
      state.startDate = action.payload;
    },
    clearCalendar: (state) => {
      state.mealData = {};
      state.startDate = new Date().toISOString();
    },
  },
});

export const { setMealData, updateMealData, setStartDate, clearCalendar } =
  calendarSlice.actions;

export default calendarSlice.reducer;
