import { avatarUri } from '../avatars'
import type { Participant } from '../types'
import { escapeHtml } from './esc'

export interface OrderResultOpts {
  order: Participant[]
  onReplay: () => void
  onHome: () => void
}

/** Écran persistant : l'ordre reste affiché pendant tout le daily, on coche au fil de l'eau. */
export function renderOrderResult(app: HTMLElement, opts: OrderResultOpts): void {
  const done = new Set<number>()

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

  function render() {
    const next = opts.order.findIndex((_, i) => !done.has(i))
    list.innerHTML = opts.order
      .map(
        (p, i) => `
      <li class="result-row ${done.has(i) ? 'done' : ''} ${i === next ? 'next' : ''}" data-i="${i}">
        <span class="rank r${i}">${i + 1}</span>
        <img class="avatar" src="${avatarUri(p.name)}" alt="" />
        <span class="name">${escapeHtml(p.name)}</span>
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
  }

  render()
  app.querySelector('#home')!.addEventListener('click', opts.onHome)
  app.querySelector('#home2')!.addEventListener('click', opts.onHome)
  app.querySelector('#replay')!.addEventListener('click', opts.onReplay)
}

export interface SingleResultOpts {
  drawn: Participant[]
  remaining: number
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

  app.querySelector('#home')!.addEventListener('click', opts.onHome)
  app.querySelector('#home2')!.addEventListener('click', opts.onHome)
  app.querySelector('#next')?.addEventListener('click', opts.onNext)
}
