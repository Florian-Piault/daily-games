import { icon, ClipboardList } from '../icons'
import { openModal } from './modal'

export interface ConfirmOverwriteOpts {
  /** Remplacer la sauvegarde du jour par le nouveau tirage. */
  onReplace: () => void
  /** Garder l'ancienne sauvegarde (choix par défaut si on ferme la modale). */
  onKeep: () => void
}

/** Demande si un nouveau tirage doit écraser la sauvegarde du jour déjà enregistrée. */
export function confirmOverwriteDraw(opts: ConfirmOverwriteOpts): void {
  let decided = false
  const { dialog, close } = openModal({
    labelledBy: 'overwrite-title',
    titleHtml: `${icon(ClipboardList)} Tirage déjà enregistré aujourd'hui`,
    bodyHtml: `
    <p class="hint">Un tirage est déjà sauvegardé pour aujourd'hui dans le journal.
    Ce nouveau tirage doit-il le remplacer ?</p>
    <footer class="modal-foot">
      <button class="btn" id="overwrite-keep">Garder l'ancienne</button>
      <button class="btn primary" id="overwrite-replace">Remplacer la sauvegarde du jour</button>
    </footer>`,
    onClose: () => {
      if (!decided) opts.onKeep()
    },
  })

  dialog.querySelector('#overwrite-replace')!.addEventListener('click', () => {
    decided = true
    opts.onReplace()
    close()
  })
  dialog.querySelector('#overwrite-keep')!.addEventListener('click', () => {
    decided = true
    opts.onKeep()
    close()
  })
}
