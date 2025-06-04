import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import boxesReducer from './boxesSlice'
import reservationsReducer from './reservationsSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    boxes: boxesReducer,
    reservations: reservationsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch 