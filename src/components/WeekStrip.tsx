const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Tira da semana (Dom-Sáb) só pra orientação visual — marca "hoje", não trava qual treino
 * é de qual dia. A rotação do plano continua sendo por ordem (1→2→3→1...), não por data. */
export default function WeekStrip() {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })

  return (
    <div className="mb-5 grid grid-cols-7 gap-1.5">
      {days.map((d, i) => {
        const isToday = d.toDateString() === today.toDateString()
        return (
          <div
            key={i}
            className={`flex flex-col items-center gap-1 rounded-lg py-1.5 ${
              isToday ? 'bg-(--color-primary)' : 'bg-(--color-surface-raised)'
            }`}
          >
            <span
              className={`text-[10px] ${isToday ? 'text-white/80' : 'text-(--color-text-muted)'}`}
            >
              {WEEKDAY_LABELS[i]}
            </span>
            <span className={`text-xs font-bold ${isToday ? 'text-white' : 'text-(--color-text)'}`}>
              {d.getDate()}
            </span>
          </div>
        )
      })}
    </div>
  )
}
