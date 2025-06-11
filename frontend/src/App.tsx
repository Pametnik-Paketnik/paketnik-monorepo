// src/App.tsx

import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './routes/Home.tsx'
import LoginPage from './routes/Login.tsx'
import SettingsPage from './routes/Settings.tsx'
import RegisterPage from './routes/Register.tsx'
import BoxesPage from './routes/Boxes'
import BoxDetailsPage from './routes/BoxDetails'
import ReservationsPage from './routes/Reservations'
import BoxOpeningHistoryPage from '@/routes/BoxOpeningHistory'
import { ProtectedRoute } from './components/protected-route'
import ReservationDetailsPage from './routes/ReservationDetails'

export default function App() {
  return (
    <Routes>
      {/* Public auth routes without layout */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected dashboard routes with layout - only accessible by HOST users */}
      <Route
        path="/"
        element={
          <ProtectedRoute requiredUserType="HOST">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="boxes" element={<BoxesPage />} />
        <Route path="boxes/:boxId" element={<BoxDetailsPage />} />
        <Route path="reservations" element={<ReservationsPage />} />
        <Route path="reservations/:id" element={<ReservationDetailsPage />} />
        <Route path="box-opening-history" element={<BoxOpeningHistoryPage />} />
      </Route>

      {/* Catch-all route - redirect any undefined routes to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
