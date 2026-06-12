import { icon, X } from '../icons'

export interface ModalHandle {
  /** L'overlay plein écran (fond assombri). */
  overlay: HTMLDivElement
  /** La boîte de dialogue elle-même (`.modal`). C'est là qu'on querySelect le contenu. */
  dialog: HTMLDivElement
  close: () => void
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ModalOpts {
  /** Contenu HTML du titre (peut inclure une icône). */
  titleHtml: string
  /** Id utilisé pour aria-labelledby et le <h2>. */
  labelledBy: string
  /** Contenu HTML inséré sous l'en-tête. */
  bodyHtml: string
  onClose?: () => void
}

/**
 * Ouvre une modale standard : overlay + en-tête (titre, bouton fermer), fermeture
 * par Escape / clic-extérieur / bouton X. Gère le focus : focus initial sur le premier
 * élément interactif, piège le focus (Tab boucle dans la modale) et le restaure sur
 * l'élément déclencheur à la fermeture.
 */
export function openModal(opts: ModalOpts): ModalHandle {
  const previouslyFocused = document.activeElement as HTMLElement | null

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${opts.labelledBy}">
    <header class="modal-head">
      <h2 id="${opts.labelledBy}">${opts.titleHtml}</h2>
      <button class="btn icon" data-modal-close title="Fermer">${icon(X)}</button>
    </header>
    ${opts.bodyHtml}
  </div>`

  const dialog = overlay.querySelector<HTMLDivElement>('.modal')!

  let closed = false
  function close() {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKey, true)
    overlay.remove()
    opts.onClose?.()
    previouslyFocused?.focus?.()
  }

  function focusables(): HTMLElement[] {
    return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    )
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key !== 'Tab') return
    const items = focusables()
    if (!items.length) {
      e.preventDefault()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement as HTMLElement | null
    if (e.shiftKey && (active === first || !dialog.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  dialog.querySelector('[data-modal-close]')!.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  document.addEventListener('keydown', onKey, true)

  document.body.appendChild(overlay)
  focusables()[0]?.focus()

  return { overlay, dialog, close }
}
