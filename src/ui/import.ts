import { icon, Users } from '../icons'
import { openModal } from './modal'

/** Ouvre la modale d'import : colle des noms séparés par virgule ou saut de ligne. */
export function openImport(onConfirm: (names: string[]) => void): void {
  const { dialog, close } = openModal({
    labelledBy: 'import-title',
    titleHtml: `${icon(Users)} Importer des joueurs`,
    bodyHtml: `
    <div class="setting-label">
      <span>Colle une liste de noms</span>
      <span class="hint">séparés par une virgule ou un saut de ligne</span>
    </div>
    <textarea class="import-area" id="import-area" rows="6" placeholder="Alice, Bob&#10;Carol&#10;Dorian"></textarea>
    <footer class="modal-foot">
      <span class="topbar-spacer"></span>
      <button class="btn primary" id="import-confirm">Ajouter à l'équipe</button>
    </footer>`,
  })

  const area = dialog.querySelector<HTMLTextAreaElement>('#import-area')!

  dialog.querySelector('#import-confirm')!.addEventListener('click', () => {
    const names = area.value
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (names.length) onConfirm(names)
    close()
  })

  area.focus()
}
