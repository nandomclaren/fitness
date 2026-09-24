// Notificação de "descanso concluído" — fecha parcialmente o gap de roadmap. Uma Live
// Activity/AOD de verdade (progress bar persistente) não dá pra fazer só com PWA (ver
// decisão no README); isso aqui é o que É possível sem código nativo: vibração (sempre,
// se suportado) + notificação OS-level via Service Worker quando a aba não está em foco.
// Não é garantido disparar com a tela travada/bloqueada (o navegador pode suspender a
// aba nesse caso) — funciona de forma confiável quando o usuário troca de app com a tela
// ligada, que é o caso mais comum de "saí do Maromba enquanto descansava".

/** Pede permissão de notificação uma única vez — nunca insiste se o usuário já negou. */
export async function requestRestNotificationPermission(): Promise<void> {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'default') return
  try {
    await Notification.requestPermission()
  } catch {
    // Navegador não suporta ou bloqueou — segue sem notificação, só vibração.
  }
}

function vibrate() {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200])
}

/**
 * Dispara o aviso de descanso concluído. Vibra sempre que suportado; só manda notificação
 * OS-level quando a aba está em background (`document.hidden`) — se o usuário está olhando
 * pro app, o pill de descanso virando vermelho já é o sinal, notificação ali seria redundante.
 */
export async function notifyRestComplete(nextExerciseName?: string): Promise<void> {
  vibrate()

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  if (!document.hidden) return

  try {
    const registration = await navigator.serviceWorker?.ready
    if (!registration) return
    await registration.showNotification('Descanso concluído 💪', {
      body: nextExerciseName ? `Hora de voltar pro ${nextExerciseName}` : 'Hora de continuar o treino',
      icon: 'icons/icon-192.png',
      tag: 'rest-complete',
    })
  } catch {
    // Sem service worker ativo (ex.: dev server) ou navegador sem suporte — vibração já rodou.
  }
}
