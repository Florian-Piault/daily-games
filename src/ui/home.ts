import { avatarUri, rerollAvatar } from '../avatars'
import { FAMILIES, GAMES } from '../games'
import {
  icon,
  BookOpen,
  Check,
  ClipboardList,
  Pencil,
  Settings,
  Star,
  Target,
  Users,
  Volume2,
  VolumeX,
  X,
  Dice6,
} from '../icons'
import { saveState, type SavedState } from '../state'
import type { DrawMode, GameDef } from '../types'
import { escapeHtml } from './esc'
import { wireFullscreenButton } from './fullscreen'
import { openImport } from './import'
import { openSettings } from './settings'

export interface HomeOpts {
  saved: SavedState
  onLaunch: (game: GameDef, present: string[], mode: DrawMode) => void
  setMuted: (m: boolean) => void
  onJournal: () => void
}

export function renderHome(app: HTMLElement, opts: HomeOpts): void {
  const { saved } = opts

  app.innerHTML = `
  <div class="screen home">
    <header class="topbar">
      <h1>${icon(Dice6)} Daily Games</h1>
      <div class="topbar-btns">
        <button class="btn icon" id="journal" title="Journal du daily">${icon(BookOpen)}</button>
        <button class="btn icon" id="settings" title="Réglages">${icon(Settings)}</button>
        <button class="btn icon" id="fullscreen" title="Plein écran"></button>
        <button class="btn icon" id="mute" title="Son">${saved.muted ? icon(VolumeX) : icon(Volume2)}</button>
      </div>
    </header>
    <main class="home-grid">
      <section class="card team-card">
        <h2>Équipe</h2>
        <ul class="team-list" id="team-list"></ul>
        <form id="add-form" class="add-row">
          <input id="add-input" type="text" placeholder="Ajouter un membre…" autocomplete="off" maxlength="24" />
          <button class="btn" type="submit">Ajouter</button>
          <button class="btn icon" type="button" id="import" title="Importer une liste">${icon(Users)}</button>
        </form>
        <p class="hint" id="present-count"></p>
      </section>
      <section class="card play-card">
        <h2>Tirage</h2>
        <div class="seg" id="mode-seg">
          <button type="button" data-mode="order" class="seg-btn">${icon(ClipboardList)} Ordre complet</button>
          <button type="button" data-mode="single" class="seg-btn">${icon(Target)} Une personne</button>
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

  function renameMember(old: string, neu: string) {
    saved.members = saved.members.map((m) => (m === old ? neu : m))
    saved.present[neu] = saved.present[old] !== false
    delete saved.present[old]
    // l'ancien nom reste le seed : l'avatar ne change pas
    saved.avatarSeed[neu] = saved.avatarSeed[old] ?? old
    delete saved.avatarSeed[old]
    if (saved.lastFirst?.name === old) saved.lastFirst.name = neu
    saved.history.forEach((h) => {
      h.order = h.order.map((n) => (n === old ? neu : n))
    })
    saveState(saved)
    renderTeam()
  }

  // Confirmation inline du retrait : une seule ligne « armée » à la fois.
  let activeDisarm: (() => void) | null = null

  function removeMember(name: string) {
    saved.members = saved.members.filter((x) => x !== name)
    delete saved.present[name]
    delete saved.avatarSeed[name]
    saveState(saved)
    renderTeam()
    renderGames()
  }

  /** Remplace les actions de la ligne par ✓ confirmer / ✕ annuler. */
  function armRemoval(row: HTMLLIElement, name: string) {
    activeDisarm?.() // ré-arme exclusif : désarme la ligne précédente
    const editBtn = row.querySelector<HTMLButtonElement>('.edit')!
    const removeBtn = row.querySelector<HTMLButtonElement>('.remove')!
    editBtn.hidden = true
    removeBtn.hidden = true
    const group = document.createElement('span')
    group.className = 'confirm-group'
    group.innerHTML = `
      <button class="confirm-del" title="Confirmer le retrait">${icon(Check, 16)}</button>
      <button class="cancel-del" title="Annuler">${icon(X, 16)}</button>`
    row.appendChild(group)

    function disarm() {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('click', onOutside, true)
      activeDisarm = null
      group.remove()
      editBtn.hidden = false
      removeBtn.hidden = false
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        disarm()
      }
    }
    function onOutside(e: MouseEvent) {
      if (!row.contains(e.target as Node)) disarm()
    }
    activeDisarm = disarm

    group.querySelector('.confirm-del')!.addEventListener('click', () => {
      disarm()
      removeMember(name)
    })
    group.querySelector('.cancel-del')!.addEventListener('click', disarm)
    // différé : évite que le clic courant déclenche aussitôt onOutside
    setTimeout(() => {
      document.addEventListener('keydown', onKey, true)
      document.addEventListener('click', onOutside, true)
    }, 0)
    group.querySelector<HTMLButtonElement>('.cancel-del')!.focus()
  }

  function renderTeam() {
    activeDisarm?.() // nettoie l'éventuel état armé avant de reconstruire la liste
    if (!saved.members.length) {
      teamList.innerHTML = '<li class="empty">Ajoute les membres de ton équipe</li>'
    } else {
      teamList.innerHTML = saved.members
        .map(
          (m) => `
        <li class="team-row" data-name="${escapeHtml(m)}">
          <label>
            <input type="checkbox" ${saved.present[m] !== false ? 'checked' : ''} />
            <img class="avatar reroll" src="${avatarUri(m)}" alt="" title="Changer d'avatar" />
            <span>${escapeHtml(m)}</span>
          </label>
          <button class="edit" title="Renommer">${icon(Pencil, 16)}</button>
          <button class="remove" title="Retirer de l'équipe">${icon(X, 16)}</button>
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
      row.querySelector('img')!.addEventListener('click', (e) => {
        e.preventDefault()
        rerollAvatar(name)
        saveState(saved)
        renderTeam()
      })
      row.querySelector('.edit')!.addEventListener('click', () => {
        row.innerHTML = `
          <img class="avatar" src="${avatarUri(name)}" alt="" />
          <form class="rename-form">
            <input type="text" value="${escapeHtml(name)}" maxlength="24" autocomplete="off" />
            <button class="btn" type="submit">OK</button>
          </form>`
        const input = row.querySelector('input')!
        input.focus()
        input.select()
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') renderTeam()
        })
        row.querySelector('form')!.addEventListener('submit', (e) => {
          e.preventDefault()
          const neu = input.value.trim()
          if (!neu || neu === name) return renderTeam()
          if (saved.members.includes(neu)) return input.select()
          renameMember(name, neu)
        })
      })
      row.querySelector('.remove')!.addEventListener('click', () => armRemoval(row, name))
    })
  }

  function renderGames() {
    const ok = presentNames().length >= 2
    const isFav = (g: GameDef) => saved.favorites.includes(g.id)
    const gameCard = (g: GameDef) => `
          <div class="game-card-wrap">
            <button class="game-card" data-id="${g.id}" ${ok ? '' : 'disabled'}>
              <span class="game-emoji">${g.emoji}</span>
              <span class="game-name">${g.name}</span>
              <span class="game-tag">${g.tagline}</span>
            </button>
            <button class="fav-btn ${isFav(g) ? 'active' : ''}" data-id="${g.id}"
              title="${isFav(g) ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${icon(Star, 16)}</button>
          </div>`
    const sections: { label: string; games: GameDef[] }[] = [
      { label: `${icon(Star, 14)} Favoris`, games: GAMES.filter(isFav) },
      ...FAMILIES.map((f) => ({
        label: f.label,
        games: GAMES.filter((g) => g.family === f.key && !isFav(g)),
      })),
    ]
    gamesGrid.innerHTML = sections
      .filter((s) => s.games.length)
      .map(
        (s) => `
      <section class="games-section">
        <h3>${s.label}</h3>
        <div class="games-grid">
          ${s.games.map(gameCard).join('')}
        </div>
      </section>`,
      )
      .join('')
    launchHint.textContent = ok
      ? 'Choisis un jeu pour lancer le tirage. Les données restent dans ton navigateur.'
      : 'Il faut au moins 2 personnes présentes pour lancer un tirage.'
    gamesGrid.querySelectorAll<HTMLButtonElement>('.game-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const game = GAMES.find((g) => g.id === btn.dataset.id)!
        opts.onLaunch(game, presentNames(), saved.mode)
      })
    })
    gamesGrid.querySelectorAll<HTMLButtonElement>('.fav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id!
        saved.favorites = saved.favorites.includes(id)
          ? saved.favorites.filter((x) => x !== id)
          : [...saved.favorites, id]
        saveState(saved)
        renderGames()
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
    muteBtn.innerHTML = saved.muted ? icon(VolumeX) : icon(Volume2)
  })

  app.querySelector('#settings')!.addEventListener('click', () => openSettings(saved))
  app.querySelector('#journal')!.addEventListener('click', opts.onJournal)
  wireFullscreenButton(app.querySelector<HTMLButtonElement>('#fullscreen')!)

  /** Ajoute un nom (tronqué à 24 car.) s'il est non vide et pas déjà dans l'équipe. Retourne true si ajouté. */
  function addMember(raw: string): boolean {
    const name = raw.trim().slice(0, 24)
    if (!name || saved.members.includes(name)) return false
    saved.members.push(name)
    saved.present[name] = true
    return true
  }

  const form = app.querySelector<HTMLFormElement>('#add-form')!
  const input = app.querySelector<HTMLInputElement>('#add-input')!
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (!addMember(input.value)) {
      input.select()
      return
    }
    saveState(saved)
    input.value = ''
    input.focus()
    renderTeam()
    renderGames()
  })

  app.querySelector('#import')!.addEventListener('click', () => {
    openImport((names) => {
      const added = names.reduce((n, name) => n + (addMember(name) ? 1 : 0), 0)
      if (!added) return
      saveState(saved)
      renderTeam()
      renderGames()
    })
  })

  renderTeam()
  renderMode()
  renderGames()
}
