import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserProfile {
  firstName: string;
  lastName: string;
  location: string;
  weight: {
    value: number;
    unit: 'kg' | 'lbs';
  };
  height: {
    value: number;
    unit: 'cm' | 'ft';
    inches?: number;
  };
  bmi: number | null;
  dietaryPreferences: string[];
  culinaryPreferences: string[];
}

interface UserState {
  profile: UserProfile | null;
  onboardingComplete: boolean;
}

const initialState: UserState = {
  profile: null,
  onboardingComplete: false,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    updateProfile: (state, action: PayloadAction<Partial<UserProfile>>) => {
      if (state.profile) {
        state.profile = { ...state.profile, ...action.payload };
      } else {
        state.profile = action.payload as UserProfile;
      }
    },
    calculateBMI: (state) => {
      if (state.profile?.weight && state.profile?.height) {
        const { weight, height } = state.profile;
        let weightInKg = weight.unit === 'kg' ? weight.value : weight.value * 0.453592;
        let heightInM = height.unit === 'cm' ? height.value / 100 : 
          (height.value * 12 + (height.inches || 0)) * 0.0254;
        
        state.profile.bmi = Math.round((weightInKg / (heightInM * heightInM)) * 10) / 10;
      }
    },
    completeOnboarding: (state) => {
      state.onboardingComplete = true;
    },
    resetUser: (state) => {
      state.profile = null;
      state.onboardingComplete = false;
    },
  },
});

export const { updateProfile, calculateBMI, completeOnboarding, resetUser } = userSlice.actions;
export default userSlice.reducer;