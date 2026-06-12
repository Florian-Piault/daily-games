import { icon, Users, X } from '../icons'

/** Ouvre la modale d'import : colle des noms séparés par virgule ou saut de ligne. */
export function openImport(onConfirm: (names: string[]) => void): void {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
    <header class="modal-head">
      <h2 id="import-title">${icon(Users)} Importer des joueurs</h2>
      <button class="btn icon" id="import-close" title="Fermer">${icon(X)}</button>
    </header>
    <div class="setting-label">
      <span>Colle une liste de noms</span>
      <span class="hint">séparés par une virgule ou un saut de ligne</span>
    </div>
    <textarea class="import-area" id="import-area" rows="6" placeholder="Alice, Bob&#10;Carol&#10;Dorian"></textarea>
    <footer class="modal-foot">
      <span class="topbar-spacer"></span>
      <button class="btn primary" id="import-confirm">Ajouter à l'équipe</button>
    </footer>
  </div>`

  const area = overlay.querySelector<HTMLTextAreaElement>('#import-area')!

  function close() {
    document.removeEventListener('keydown', onKey)
    overlay.remove()
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }
  function confirm() {
    const names = area.value
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (names.length) onConfirm(names)
    close()
  }

  overlay.querySelector('#import-confirm')!.addEventListener('click', confirm)
  overlay.querySelector('#import-close')!.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  document.addEventListener('keydown', onKey)

  document.body.appendChild(overlay)
  area.focus()
}
