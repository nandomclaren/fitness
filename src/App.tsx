import { Routes, Route } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import PlayerScreen from './screens/PlayerScreen'
import SummaryScreen from './screens/SummaryScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import GoalsScreen from './screens/GoalsScreen'
import HistoryScreen from './screens/HistoryScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/onboarding" element={<OnboardingScreen />} />
      <Route path="/objetivos" element={<GoalsScreen />} />
      <Route path="/historico" element={<HistoryScreen />} />
      <Route path="/treino" element={<PlayerScreen />} />
      <Route path="/resumo/:sessionId" element={<SummaryScreen />} />
    </Routes>
  )
}
