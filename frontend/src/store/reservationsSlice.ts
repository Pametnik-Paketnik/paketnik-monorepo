import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchReservations = createAsyncThunk('reservations/fetchReservations', async (_, { rejectWithValue }) => {
  try {
    const res = await fetch('http://localhost:3000/api/reservations');
    if (!res.ok) throw new Error('Failed to fetch reservations');
    return await res.json();
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

const reservationsSlice = createSlice({
  name: 'reservations',
  initialState: {
    items: [],
    loading: false,
    error: null as string | null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchReservations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReservations.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchReservations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default reservationsSlice.reducer; 