import { avatarUri } from '../avatars'
import type { Participant } from '../types'
import { escapeHtml } from './esc'

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export interface OrderResultOpts {
  order: Participant[]
  timeboxSec: number
  onTimeUp?: () => void
  onSpeakTime?: (name: string, seconds: number) => void
  onReplay: () => void
  onHome: () => void
}

/** Écran persistant : l'ordre reste affiché pendant tout le daily, on coche au fil de l'eau. */
export function renderOrderResult(app: HTMLElement, opts: OrderResultOpts): void {
  const done = new Set<number>()
  let timerStart = performance.now()
  let lastNext = -2
  let overNotified = false

  app.innerHTML = `
  <div class="screen result">
    <header class="topbar">
      <button class="btn icon" id="home" title="Accueil">←</button>
      <h1>📋 Ordre de passage</h1>
      <span class="topbar-spacer"></span>
    </header>
    <main class="result-main">
      <ul class="result-list" id="list"></ul>
      <p class="hint" id="result-hint">Clique sur une personne quand elle a fini de parler.</p>
      <div class="actions">
        <button class="btn" id="replay">🎲 Refaire le tirage</button>
        <button class="btn" id="home2">🏠 Accueil</button>
      </div>
    </main>
  </div>`

  const list = app.querySelector<HTMLUListElement>('#list')!
  const hint = app.querySelector<HTMLParagraphElement>('#result-hint')!

  function updateTimer() {
    const el = list.querySelector<HTMLSpanElement>('.timer')
    const bar = list.querySelector<HTMLDivElement>('.timebox-bar')
    if (!el || !bar) return
    const elapsed = (performance.now() - timerStart) / 1000
    const remaining = opts.timeboxSec - elapsed
    const over = remaining < 0
    el.textContent = over ? `+${fmtTime(-remaining)}` : fmtTime(remaining)
    el.classList.toggle('over', over)
    bar.style.width = `${Math.min(100, (elapsed / opts.timeboxSec) * 100)}%`
    bar.classList.toggle('over', over)
    if (over && !overNotified) {
      overNotified = true
      opts.onTimeUp?.()
    }
  }

  /** Crédite le temps écoulé à l'orateur courant et repart de zéro. */
  function flushSpeaker() {
    if (lastNext >= 0) {
      const sec = (performance.now() - timerStart) / 1000
      if (sec >= 1) opts.onSpeakTime?.(opts.order[lastNext].name, sec)
    }
    timerStart = performance.now()
  }

  function render() {
    const next = opts.order.findIndex((_, i) => !done.has(i))
    if (next !== lastNext) {
      flushSpeaker()
      lastNext = next
      overNotified = false
    }
    list.innerHTML = opts.order
      .map(
        (p, i) => `
      <li class="result-row ${done.has(i) ? 'done' : ''} ${i === next ? 'next' : ''}" data-i="${i}">
        <span class="rank r${i}">${i + 1}</span>
        <img class="avatar" src="${avatarUri(p.name)}" alt="" />
        <span class="name">${escapeHtml(p.name)}</span>
        ${i === next && opts.timeboxSec > 0 ? '<span class="timer"></span><div class="timebox-bar"></div>' : ''}
        <span class="check">${done.has(i) ? '✅' : i === next ? '🎤' : ''}</span>
      </li>`,
      )
      .join('')
    hint.textContent =
      next === -1 ? '🎉 Tout le monde est passé — bon daily !' : 'Clique sur une personne quand elle a fini de parler.'
    list.querySelectorAll<HTMLLIElement>('.result-row').forEach((row) => {
      row.addEventListener('click', () => {
        const i = Number(row.dataset.i)
        if (done.has(i)) done.delete(i)
        else done.add(i)
        render()
      })
    })
    updateTimer()
  }

  render()
  if (opts.timeboxSec > 0) {
    const iv = setInterval(() => {
      if (!list.isConnected) return clearInterval(iv)
      updateTimer()
    }, 250)
  }
  const leave = (go: () => void) => () => {
    flushSpeaker()
    go()
  }
  app.querySelector('#home')!.addEventListener('click', leave(opts.onHome))
  app.querySelector('#home2')!.addEventListener('click', leave(opts.onHome))
  app.querySelector('#replay')!.addEventListener('click', leave(opts.onReplay))
}

export interface SingleResultOpts {
  drawn: Participant[]
  remaining: number
  timeboxSec: number
  onTimeUp?: () => void
  onSpeakTime?: (name: string, seconds: number) => void
  onNext: () => void
  onHome: () => void
}

export function renderSingleResult(app: HTMLElement, opts: SingleResultOpts): void {
  const last = opts.drawn[opts.drawn.length - 1]
  const previous = opts.drawn.slice(0, -1)

  app.innerHTML = `
  <div class="screen result">
    <header class="topbar">
      <button class="btn icon" id="home" title="Accueil">←</button>
      <h1>🎯 Tirage au sort</h1>
      <span class="topbar-spacer"></span>
    </header>
    <main class="result-main">
      <div class="winner-card">
        <img class="avatar big" src="${avatarUri(last.name)}" alt="" />
        <div>
          <p class="winner-label">C'est au tour de</p>
          <p class="winner-name">${escapeHtml(last.name)}</p>
        </div>
      </div>
      ${opts.timeboxSec > 0 ? '<div class="winner-timer">⏱ <span class="timer"></span></div>' : ''}
      ${
        previous.length
          ? `<h3>Déjà passé·e·s</h3>
             <ul class="mini-list">${previous
               .map(
                 (p, i) => `
               <li><span class="rank">${i + 1}</span><img class="avatar" src="${avatarUri(p.name)}" alt="" /><span>${escapeHtml(p.name)}</span></li>`,
               )
               .join('')}</ul>`
          : ''
      }
      <div class="actions">
        ${
          opts.remaining > 0
            ? `<button class="btn primary" id="next">🎲 Tirer la personne suivante (${opts.remaining} restant·e·s)</button>`
            : '<p class="all-done">🎉 Tout le monde est passé !</p>'
        }
        <button class="btn" id="home2">🏠 Accueil</button>
      </div>
    </main>
  </div>`

  if (opts.timeboxSec > 0) {
    const el = app.querySelector<HTMLSpanElement>('.winner-timer .timer')!
    const timerStart = performance.now()
    let overNotified = false
    const update = () => {
      if (!el.isConnected) return clearInterval(iv)
      const remaining = opts.timeboxSec - (performance.now() - timerStart) / 1000
      const over = remaining < 0
      el.textContent = over ? `+${fmtTime(-remaining)}` : fmtTime(remaining)
      el.classList.toggle('over', over)
      if (over && !overNotified) {
        overNotified = true
        opts.onTimeUp?.()
      }
    }
    const iv = setInterval(update, 250)
    update()
  }

  const speakStart = performance.now()
  const leave = (go: () => void) => () => {
    const sec = (performance.now() - speakStart) / 1000
    if (sec >= 1) opts.onSpeakTime?.(last.name, sec)
    go()
  }
  app.querySelector('#home')!.addEventListener('click', leave(opts.onHome))
  app.querySelector('#home2')!.addEventListener('click', leave(opts.onHome))
  app.querySelector('#next')?.addEventListener('click', leave(opts.onNext))
}
