import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";

// Define the logout thunk that clears all user data
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { dispatch }) => {
    // Clear auth data
    dispatch(logout());

    // Clear chat data
    dispatch({ type: "chat/clearChat" });

    // Clear calendar data
    dispatch({ type: "calendar/clearCalendar" });

    // Clear meal plans
    dispatch({ type: "mealPlans/clearMealPlans" });

    // Clear user data
    dispatch({ type: "user/resetUser" });
  }
);

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (
      state,
      action: PayloadAction<{
        accessToken: string;
        refreshToken: string;
        user: AuthState["user"];
      }>
    ) => {
      state.isAuthenticated = true;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.accessToken = null;
      state.refreshToken = null;
      state.user = null;
    },
    updateTokens: (
      state,
      action: PayloadAction<{
        accessToken: string;
        refreshToken: string;
      }>
    ) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
  },
});

export const { login, logout, updateTokens } = authSlice.actions;
export default authSlice.reducer;
