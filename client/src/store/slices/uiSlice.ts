import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  sidebarOpen: boolean;
  activityFeedOpen: boolean;
  theme: 'light' | 'dark';
}

const initialState: UiState = {
  sidebarOpen: true,
  activityFeedOpen: false,
  theme: 'light',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    toggleActivityFeed: (state, action: PayloadAction<boolean | undefined>) => {
      state.activityFeedOpen = action.payload ?? !state.activityFeedOpen;
    },
    setTheme: (state, action: PayloadAction<UiState['theme']>) => {
      state.theme = action.payload;
      document.documentElement.classList.toggle('dark', action.payload === 'dark');
    },
  },
});

export const { toggleSidebar, toggleActivityFeed, setTheme } = uiSlice.actions;
export default uiSlice.reducer;
