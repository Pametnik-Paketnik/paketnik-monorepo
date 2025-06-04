// src/App.tsx

import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './routes/Home.tsx'
import LoginPage from './routes/Login.tsx'
import SettingsPage from './routes/About.tsx'
import RegisterPage from './routes/Register.tsx'
import BoxesPage from './routes/Boxes'
import ReservationsPage from './routes/Reservations'

export default function App() {
  return (
    <Routes>
      {/* Auth routes without layout */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* Main routes with layout */}
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="boxes" element={<BoxesPage />} />
        <Route path="reservations" element={<ReservationsPage />} />
      </Route>
    </Routes>
  )
}
