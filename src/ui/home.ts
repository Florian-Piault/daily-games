import { avatarUri } from '../avatars'
import { FAMILIES, GAMES } from '../games'
import { saveState, type SavedState } from '../state'
import type { DrawMode, GameDef } from '../types'
import { escapeHtml } from './esc'

export interface HomeOpts {
  saved: SavedState
  onLaunch: (game: GameDef, present: string[], mode: DrawMode) => void
  setMuted: (m: boolean) => void
}

export function renderHome(app: HTMLElement, opts: HomeOpts): void {
  const { saved } = opts

  app.innerHTML = `
  <div class="screen home">
    <header class="topbar">
      <h1>🎲 Daily Games</h1>
      <button class="btn icon" id="mute" title="Son">${saved.muted ? '🔇' : '🔊'}</button>
    </header>
    <main class="home-grid">
      <section class="card team-card">
        <h2>Équipe</h2>
        <ul class="team-list" id="team-list"></ul>
        <form id="add-form" class="add-row">
          <input id="add-input" type="text" placeholder="Ajouter un membre…" autocomplete="off" maxlength="24" />
          <button class="btn" type="submit">Ajouter</button>
        </form>
        <p class="hint" id="present-count"></p>
      </section>
      <section class="card play-card">
        <h2>Tirage</h2>
        <div class="seg" id="mode-seg">
          <button type="button" data-mode="order" class="seg-btn">📋 Ordre complet</button>
          <button type="button" data-mode="single" class="seg-btn">🎯 Une personne</button>
        </div>
        <div id="games"></div>
        <p class="hint" id="launch-hint">Choisis un jeu pour lancer le tirage. Les données restent dans ton navigateur.</p>
      </section>
    </main>
  </div>`

  const teamList = app.querySelector<HTMLUListElement>('#team-list')!
  const gamesGrid = app.querySelector<HTMLDivElement>('#games')!
  const countHint = app.querySelector<HTMLParagraphElement>('#present-count')!
  const launchHint = app.querySelector<HTMLParagraphElement>('#launch-hint')!

  const presentNames = () => saved.members.filter((m) => saved.present[m] !== false)

  function renderTeam() {
    if (!saved.members.length) {
      teamList.innerHTML = '<li class="empty">Ajoute les membres de ton équipe 👇</li>'
    } else {
      teamList.innerHTML = saved.members
        .map(
          (m) => `
        <li class="team-row" data-name="${escapeHtml(m)}">
          <label>
            <input type="checkbox" ${saved.present[m] !== false ? 'checked' : ''} />
            <img class="avatar" src="${avatarUri(m)}" alt="" />
            <span>${escapeHtml(m)}</span>
          </label>
          <button class="remove" title="Retirer de l'équipe">✕</button>
        </li>`,
        )
        .join('')
    }
    countHint.textContent = saved.members.length
      ? `${presentNames().length} présent·e·s sur ${saved.members.length} — décoche les absents du jour.`
      : ''
    teamList.querySelectorAll<HTMLLIElement>('.team-row').forEach((row) => {
      const name = row.dataset.name!
      row.querySelector('input')!.addEventListener('change', (e) => {
        saved.present[name] = (e.target as HTMLInputElement).checked
        saveState(saved)
        renderTeam()
        renderGames()
      })
      row.querySelector('.remove')!.addEventListener('click', () => {
        saved.members = saved.members.filter((x) => x !== name)
        delete saved.present[name]
        saveState(saved)
        renderTeam()
        renderGames()
      })
    })
  }

  function renderGames() {
    const ok = presentNames().length >= 2
    gamesGrid.innerHTML = FAMILIES.map(
      (f) => `
      <section class="games-section">
        <h3>${f.label}</h3>
        <div class="games-grid">
          ${GAMES.filter((g) => g.family === f.key)
            .map(
              (g) => `
          <button class="game-card" data-id="${g.id}" ${ok ? '' : 'disabled'}>
            <span class="game-emoji">${g.emoji}</span>
            <span class="game-name">${g.name}</span>
            <span class="game-tag">${g.tagline}</span>
          </button>`,
            )
            .join('')}
        </div>
      </section>`,
    ).join('')
    launchHint.textContent = ok
      ? 'Choisis un jeu pour lancer le tirage. Les données restent dans ton navigateur.'
      : 'Il faut au moins 2 personnes présentes pour lancer un tirage.'
    gamesGrid.querySelectorAll<HTMLButtonElement>('.game-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const game = GAMES.find((g) => g.id === btn.dataset.id)!
        opts.onLaunch(game, presentNames(), saved.mode)
      })
    })
  }

  function renderMode() {
    app.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === saved.mode)
    })
  }

  app.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      saved.mode = b.dataset.mode as DrawMode
      saveState(saved)
      renderMode()
    })
  })

  const muteBtn = app.querySelector<HTMLButtonElement>('#mute')!
  muteBtn.addEventListener('click', () => {
    opts.setMuted(!saved.muted)
    muteBtn.textContent = saved.muted ? '🔇' : '🔊'
  })

  const form = app.querySelector<HTMLFormElement>('#add-form')!
  const input = app.querySelector<HTMLInputElement>('#add-input')!
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const name = input.value.trim()
    if (!name || saved.members.includes(name)) {
      input.select()
      return
    }
    saved.members.push(name)
    saved.present[name] = true
    saveState(saved)
    input.value = ''
    input.focus()
    renderTeam()
    renderGames()
  })

  renderTeam()
  renderMode()
  renderGames()
}
