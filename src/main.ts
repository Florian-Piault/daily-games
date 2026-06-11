import './style.css'
import type { DrawMode, GameDef, Participant } from './types'
import { loadState, saveState, todayKey } from './state'
import { Sfx } from './audio'
import { avatarFor, colorFor, initAvatarVariants } from './avatars'
import { computeOrder } from './draw'
import { renderHome } from './ui/home'
import { renderOrderResult, renderSingleResult } from './ui/result'

const app = document.getElementById('app')!
const saved = loadState()
initAvatarVariants(saved.avatarSeed)
const sfx = new Sfx(saved.muted)

let cleanupGame: (() => void) | null = null
let singleRun: { game: GameDef; present: string[]; drawn: Participant[] } | null = null

function stopGame(): void {
  if (cleanupGame) {
    cleanupGame()
    cleanupGame = null
  }
}

function setMuted(m: boolean): void {
  sfx.muted = m
  saved.muted = m
  saveState(saved)
}

async function toParticipants(names: string[]): Promise<Participant[]> {
  return Promise.all(
    names.map(async (name) => ({ name, color: colorFor(name), img: await avatarFor(name) })),
  )
}

function showHome(): void {
  stopGame()
  singleRun = null
  renderHome(app, { saved, onLaunch, setMuted })
}

function forbiddenFirstFor(present: string[]): string | null {
  const lf = saved.lastFirst
  return lf && lf.date !== todayKey() && present.includes(lf.name) && present.length > 1
    ? lf.name
    : null
}

function recordFirst(name: string): void {
  saved.lastFirst = { date: todayKey(), name }
  saveState(saved)
}

function onLaunch(game: GameDef, present: string[], mode: DrawMode): void {
  saved.mode = mode
  saved.lastGame = game.id
  saveState(saved)
  singleRun = mode === 'single' ? { game, present, drawn: [] } : null
  void runGame(game, present, mode)
}

async function runGame(game: GameDef, names: string[], mode: DrawMode): Promise<void> {
  stopGame()
  const participants = await toParticipants(names)
  const forbidden = forbiddenFirstFor(names)
  const order = computeOrder(participants, forbidden)

  app.innerHTML = `
  <div class="screen game-screen">
    <header class="topbar">
      <button class="btn icon" id="back" title="Annuler">←</button>
      <h1>${game.emoji} ${game.name}</h1>
      <button class="btn icon" id="mute" title="Son">${saved.muted ? '🔇' : '🔊'}</button>
    </header>
    <div class="game-stage"><canvas id="game-canvas"></canvas></div>
  </div>`

  app.querySelector('#back')!.addEventListener('click', showHome)
  const muteBtn = app.querySelector<HTMLButtonElement>('#mute')!
  muteBtn.addEventListener('click', () => {
    setMuted(!sfx.muted)
    muteBtn.textContent = sfx.muted ? '🔇' : '🔊'
  })

  const canvas = app.querySelector<HTMLCanvasElement>('#game-canvas')!
  cleanupGame = game.run({
    canvas,
    participants,
    order,
    mode,
    forbiddenFirst: forbidden,
    sfx,
    pace: saved.pace,
    onFinish: (finalOrder) => onGameFinish(game, names, mode, finalOrder),
  })
}

function onGameFinish(game: GameDef, names: string[], mode: DrawMode, finalOrder: Participant[]): void {
  stopGame()
  // anti-répétition : on mémorise le « premier » du jour (pas les tirages suivants du mode une-personne)
  if (mode === 'order' || singleRun!.drawn.length === 0) recordFirst(finalOrder[0].name)
  if (mode === 'order') {
    renderOrderResult(app, {
      order: finalOrder,
      onReplay: () => void runGame(game, names, 'order'),
      onHome: showHome,
    })
  } else {
    singleRun!.drawn.push(finalOrder[0])
    showSingleResult()
  }
}

function showSingleResult(): void {
  const run = singleRun!
  const remaining = run.present.filter((n) => !run.drawn.some((d) => d.name === n))
  renderSingleResult(app, {
    drawn: run.drawn,
    remaining: remaining.length,
    onNext: async () => {
      if (remaining.length === 1) {
        // plus de suspense nécessaire : la dernière personne passe d'office
        run.drawn.push((await toParticipants(remaining))[0])
        showSingleResult()
      } else {
        void runGame(run.game, remaining, 'single')
      }
    },
    onHome: showHome,
  })
}

showHome()
