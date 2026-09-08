import { Routes, Route } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import PlayerScreen from './screens/PlayerScreen'
import SummaryScreen from './screens/SummaryScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/treino" element={<PlayerScreen />} />
      <Route path="/resumo/:sessionId" element={<SummaryScreen />} />
    </Routes>
  )
}
