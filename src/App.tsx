import { Routes, Route } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import PlayerScreen from './screens/PlayerScreen'
import SummaryScreen from './screens/SummaryScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import GoalsScreen from './screens/GoalsScreen'
import EquipmentScreen from './screens/EquipmentScreen'
import HistoryScreen from './screens/HistoryScreen'
import WarmupScreen from './screens/WarmupScreen'
import CooldownScreen from './screens/CooldownScreen'
import CoachScreen from './screens/CoachScreen'
import PlanWizardScreen from './screens/PlanWizardScreen'
import AllPlansScreen from './screens/AllPlansScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/onboarding" element={<OnboardingScreen />} />
      <Route path="/objetivos" element={<GoalsScreen />} />
      <Route path="/equipamento" element={<EquipmentScreen />} />
      <Route path="/historico" element={<HistoryScreen />} />
      <Route path="/coach" element={<CoachScreen />} />
      <Route path="/planos" element={<AllPlansScreen />} />
      <Route path="/planos/novo" element={<PlanWizardScreen />} />
      <Route path="/aquecimento" element={<WarmupScreen />} />
      <Route path="/treino" element={<PlayerScreen />} />
      <Route path="/desaquecimento/:sessionId" element={<CooldownScreen />} />
      <Route path="/resumo/:sessionId" element={<SummaryScreen />} />
    </Routes>
  )
}
