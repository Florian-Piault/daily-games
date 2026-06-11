import { DEFAULT_PACE, saveState, type SavedState, type ThemeKey } from '../state'
import type { Pace } from '../types'

interface Row {
  key: keyof Pace
  label: string
  hint: string
}

const ROWS: Row[] = [
  { key: 'round', label: 'Durée d’un tour', hint: 'manches, spins, éliminations' },
  { key: 'continuous', label: 'Jeux continus', hint: 'course, largage, canon' },
  { key: 'intro', label: 'Intros', hint: 'comptes à rebours, mélanges' },
  { key: 'result', label: 'Pause résultat', hint: 'avant l’écran de fin' },
]

const STEPS = [
  { label: 'Court', value: 0.6 },
  { label: 'Normal', value: 1 },
  { label: 'Long', value: 1.5 },
]

const TIMEBOX_STEPS = [
  { label: 'Off', value: 0 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '3 min', value: 180 },
]

const THEMES: { key: ThemeKey; emoji: string; label: string }[] = [
  { key: 'dark', emoji: '🌙', label: 'Foncé' },
  { key: 'light', emoji: '☀️', label: 'Clair' },
  { key: 'printemps', emoji: '🌸', label: 'Printemps' },
  { key: 'ete', emoji: '🏖️', label: 'Été' },
  { key: 'automne', emoji: '🍂', label: 'Automne' },
  { key: 'hiver', emoji: '❄️', label: 'Hiver' },
  { key: 'noel', emoji: '🎄', label: 'Noël' },
  { key: 'halloween', emoji: '🎃', label: 'Halloween' },
]

export function applyTheme(theme: ThemeKey): void {
  document.documentElement.dataset.theme = theme
}

/** Ouvre la modale « Réglages ». Les changements sont sauvegardés immédiatement. */
export function openSettings(saved: SavedState): void {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <header class="modal-head">
      <h2 id="settings-title">⚙️ Réglages</h2>
      <button class="btn icon" id="settings-close" title="Fermer">✕</button>
    </header>
    <div class="setting-label">
      <span>Thème</span>
    </div>
    <div class="theme-grid" id="theme-grid">
      ${THEMES.map(
        (t) => `
      <button type="button" class="theme-btn" data-theme="${t.key}">
        <span class="theme-emoji">${t.emoji}</span>
        <span>${t.label}</span>
      </button>`,
      ).join('')}
    </div>
    <div class="setting-row">
      <div class="setting-label">
        <span>Time-box</span>
        <span class="hint">temps de parole par personne</span>
      </div>
      <div class="seg" id="timebox-seg">
        ${TIMEBOX_STEPS.map((s) => `<button type="button" class="seg-btn" data-value="${s.value}">${s.label}</button>`).join('')}
      </div>
    </div>
    ${ROWS.map(
      (row) => `
    <div class="setting-row">
      <div class="setting-label">
        <span>${row.label}</span>
        <span class="hint">${row.hint}</span>
      </div>
      <div class="seg" data-key="${row.key}">
        ${STEPS.map((s) => `<button type="button" class="seg-btn" data-value="${s.value}" title="×${s.value}">${s.label}</button>`).join('')}
      </div>
    </div>`,
    ).join('')}
    <footer class="modal-foot">
      <button class="btn" id="settings-reset">Réinitialiser</button>
      <p class="hint">Appliqué au prochain jeu lancé.</p>
    </footer>
  </div>`

  function sync() {
    overlay.querySelectorAll<HTMLDivElement>('.seg[data-key]').forEach((seg) => {
      const value = saved.pace[seg.dataset.key as keyof Pace]
      seg.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.value) === value)
      })
    })
    overlay.querySelectorAll<HTMLButtonElement>('#timebox-seg .seg-btn').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.value) === saved.timeboxSec)
    })
    overlay.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.theme === saved.theme)
    })
  }

  overlay.querySelectorAll<HTMLDivElement>('.seg[data-key]').forEach((seg) => {
    const key = seg.dataset.key as keyof Pace
    seg.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((b) => {
      b.addEventListener('click', () => {
        saved.pace[key] = Number(b.dataset.value)
        saveState(saved)
        sync()
      })
    })
  })

  overlay.querySelectorAll<HTMLButtonElement>('#timebox-seg .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      saved.timeboxSec = Number(b.dataset.value)
      saveState(saved)
      sync()
    })
  })

  overlay.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((b) => {
    b.addEventListener('click', () => {
      saved.theme = b.dataset.theme as ThemeKey
      applyTheme(saved.theme)
      saveState(saved)
      sync()
    })
  })

  overlay.querySelector('#settings-reset')!.addEventListener('click', () => {
    saved.pace = { ...DEFAULT_PACE }
    saved.timeboxSec = 0
    saveState(saved)
    sync()
  })

  function close() {
    document.removeEventListener('keydown', onKey)
    overlay.remove()
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }
  overlay.querySelector('#settings-close')!.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  document.addEventListener('keydown', onKey)

  sync()
  document.body.appendChild(overlay)
}
