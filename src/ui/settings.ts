import { DEFAULT_PACE, saveState, type SavedState } from '../state'
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

/** Ouvre la modale « Réglages de rythme ». Les changements sont sauvegardés immédiatement. */
export function openSettings(saved: SavedState): void {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <header class="modal-head">
      <h2 id="settings-title">⚙️ Réglages de rythme</h2>
      <button class="btn icon" id="settings-close" title="Fermer">✕</button>
    </header>
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

  overlay.querySelector('#settings-reset')!.addEventListener('click', () => {
    saved.pace = { ...DEFAULT_PACE }
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
