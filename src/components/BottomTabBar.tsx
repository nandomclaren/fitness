import { NavLink } from 'react-router-dom'
import { History, Home, Settings, Sparkles } from 'lucide-react'

const TABS = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/coach', label: 'Coach', icon: Sparkles, end: false },
  { to: '/historico', label: 'Histórico', icon: History, end: false },
  { to: '/objetivos', label: 'Ajustes', icon: Settings, end: false },
]

export default function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex h-16 max-w-lg items-stretch border-t border-(--color-border) bg-(--color-bg)">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
              isActive ? 'text-(--color-primary)' : 'text-(--color-text-muted)'
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
