import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatState {
  messages: Message[];
  dietary: string[];
  culinary: string[];
  showInitialPrompt: boolean;
}

const initialState: ChatState = {
  messages: [],
  dietary: [],
  culinary: [],
  showInitialPrompt: true,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    setMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = action.payload;
    },
    setDietaryPreferences: (state, action: PayloadAction<string[]>) => {
      state.dietary = action.payload;
    },
    setCulinaryPreferences: (state, action: PayloadAction<string[]>) => {
      state.culinary = action.payload;
    },
    setShowInitialPrompt: (state, action: PayloadAction<boolean>) => {
      state.showInitialPrompt = action.payload;
    },
    clearChat: (state) => {
      state.messages = [];
      state.dietary = [];
      state.culinary = [];
      state.showInitialPrompt = true;
    },
  },
});

export const {
  addMessage,
  setMessages,
  setDietaryPreferences,
  setCulinaryPreferences,
  setShowInitialPrompt,
  clearChat,
} = chatSlice.actions;

export default chatSlice.reducer;
