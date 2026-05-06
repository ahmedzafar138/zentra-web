import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import authSlice from "./slices/authSlice";
import userSlice from "./slices/userSlice";
import mealSlice from "./slices/mealSlice";
import mealPlansSlice from "./slices/mealPlansSlice";
import chatSlice from "./slices/chatSlice";
import calendarSlice from "./slices/calendarSlice";

const persistAuthConfig = {
  key: "auth",
  storage,
  whitelist: ["isAuthenticated", "accessToken", "refreshToken", "user"],
};

const persistChatConfig = {
  key: "chat",
  storage,
  whitelist: ["messages", "dietary", "culinary", "showInitialPrompt"],
};

const persistCalendarConfig = {
  key: "calendar",
  storage,
  whitelist: ["mealData", "startDate"],
};

const persistedAuthReducer = persistReducer(persistAuthConfig, authSlice);
const persistedChatReducer = persistReducer(persistChatConfig, chatSlice);
const persistedCalendarReducer = persistReducer(
  persistCalendarConfig,
  calendarSlice
);

const rootReducer = combineReducers({
  auth: persistedAuthReducer,
  user: userSlice,
  meal: mealSlice,
  mealPlans: mealPlansSlice,
  chat: persistedChatReducer,
  calendar: persistedCalendarReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
