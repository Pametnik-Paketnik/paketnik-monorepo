// src/App.tsx

import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './routes/Home.tsx'
import SettingsPage from './routes/About.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Add more routes here */}
      </Route>
    </Routes>
  )
}
