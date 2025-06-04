import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from './index';

export const fetchBoxes = createAsyncThunk('boxes/fetchBoxes', async (_, { rejectWithValue, getState }) => {
  try {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    
    const res = await fetch('http://localhost:3000/api/boxes', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error('Failed to fetch boxes');
    return await res.json();
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

const boxesSlice = createSlice({
  name: 'boxes',
  initialState: {
    items: [],
    loading: false,
    error: null as string | null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBoxes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBoxes.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchBoxes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default boxesSlice.reducer; 