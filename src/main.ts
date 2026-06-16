import './style.css'
import type { DrawMode, GameDef, Participant } from './types'
import {
  clearSession,
  loadState,
  recordDraw,
  recordSpeakTime,
  saveSession,
  saveState,
  todayKey,
  type ActiveSession,
} from './state'
import { Sfx } from './audio'
import { avatarFor, colorFor, initAvatarVariants } from './avatars'
import { computeOrder } from './draw'
import { GAMES } from './games'
import { readPalette } from './games/palette'
import { icon, ArrowLeft, Volume2, VolumeX } from './icons'
import { confirmOverwriteDraw } from './ui/confirm'
import { wireFullscreenButton } from './ui/fullscreen'
import { renderHome } from './ui/home'
import { renderJournal } from './ui/journal'
import { renderOrderResult, renderSingleResult } from './ui/result'
import { applyTheme } from './ui/settings'

const app = document.getElementById('app')!
const saved = loadState()
initAvatarVariants(saved.avatarSeed)
applyTheme(saved.theme)
const sfx = new Sfx(saved.muted)

let cleanupGame: (() => void) | null = null
let singleRun: { game: GameDef; present: string[]; drawn: Participant[] } | null = null
/** Daily en cours en mémoire, miroir de saved.session ; null entre deux tirages. */
let session: ActiveSession | null = null

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
  renderHome(app, { saved, onLaunch, setMuted, onJournal: showJournal })
}

function showJournal(): void {
  stopGame()
  renderJournal(app, { saved, onHome: showHome })
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
  // nouveau cycle : la session sera (re)créée à l'affichage du résultat, journal « pending »
  session = null
  singleRun = mode === 'single' ? { game, present, drawn: [] } : null
  void runGame(game, present, mode)
}

/**
 * Enregistre le tirage au journal selon le sort décidé pour la session.
 * À la fin d'un nouveau tirage alors qu'une entrée du jour existe déjà (session
 * précédente), demande s'il faut écraser la sauvegarde du jour.
 */
function maybeRecord(game: GameDef, orderNames: string[]): void {
  const s = session
  if (!s || s.journal === 'declined') return
  if (s.journal === 'recorded') {
    recordDraw(saved, game.id, orderNames)
    return
  }
  // pending : première écriture de cette session
  if (!saved.history.some((e) => e.date === todayKey())) {
    recordDraw(saved, game.id, orderNames)
    s.journal = 'recorded'
    saveSession(saved, s)
    return
  }
  confirmOverwriteDraw({
    onReplace: () => {
      recordDraw(saved, game.id, orderNames)
      s.journal = 'recorded'
      saveSession(saved, s)
    },
    onKeep: () => {
      s.journal = 'declined'
      saveSession(saved, s)
    },
  })
}

/** Affiche l'écran de passage « Ordre complet » et persiste la progression des coches. */
function renderOrderScreen(
  game: GameDef,
  names: string[],
  order: Participant[],
  initialDone: number[],
): void {
  renderOrderResult(app, {
    order,
    timeboxSec: saved.timeboxSec,
    initialDone,
    onTimeUp: () => sfx.timeUp(),
    onSpeakTime: (name, sec) => recordSpeakTime(saved, name, sec),
    onProgress: (doneIdx, complete) => {
      if (!session) return
      session.done = doneIdx
      if (complete) clearSession(saved)
      else saveSession(saved, session)
    },
    onReplay: () => void runGame(game, names, 'order'),
    onHome: showHome,
  })
}

async function runGame(
  game: GameDef,
  names: string[],
  mode: DrawMode,
  withIntro = true,
): Promise<void> {
  stopGame()
  const participants = await toParticipants(names)
  const forbidden = forbiddenFirstFor(names)
  const order = computeOrder(participants, forbidden)
  // mise en scène mémorisée ; l'intro ne joue qu'au premier tirage d'une série « une personne »
  const prefs = saved.stagePrefs[game.id]
  const stage = prefs ? { intro: withIntro ? prefs.intro : 'none', format: prefs.format } : undefined

  app.innerHTML = `
  <div class="screen game-screen">
    <header class="topbar">
      <button class="btn icon" id="back" title="Annuler">${icon(ArrowLeft)}</button>
      <h1>${game.emoji} ${game.name}</h1>
      <div class="topbar-btns">
        <button class="btn icon" id="fullscreen" title="Plein écran"></button>
        <button class="btn icon" id="mute" title="Son">${saved.muted ? icon(VolumeX) : icon(Volume2)}</button>
      </div>
    </header>
    <div class="game-stage"><canvas id="game-canvas"></canvas></div>
  </div>`

  app.querySelector('#back')!.addEventListener('click', showHome)
  wireFullscreenButton(app.querySelector<HTMLButtonElement>('#fullscreen')!)
  const muteBtn = app.querySelector<HTMLButtonElement>('#mute')!
  muteBtn.addEventListener('click', () => {
    setMuted(!sfx.muted)
    muteBtn.innerHTML = sfx.muted ? icon(VolumeX) : icon(Volume2)
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
    stage,
    palette: readPalette(),
    suspense: saved.suspense,
    onFinish: (finalOrder) => onGameFinish(game, names, mode, finalOrder),
  })
}

function onGameFinish(game: GameDef, names: string[], mode: DrawMode, finalOrder: Participant[]): void {
  stopGame()
  // anti-répétition : on mémorise le « premier » du jour (pas les tirages suivants du mode une-personne)
  if (mode === 'order' || singleRun!.drawn.length === 0) recordFirst(finalOrder[0].name)
  if (mode === 'order') {
    const orderNames = finalOrder.map((p) => p.name)
    session = {
      date: todayKey(),
      game: game.id,
      mode,
      journal: session?.journal ?? 'pending',
      order: orderNames,
      done: [],
      drawn: [],
      present: [],
    }
    saveSession(saved, session)
    renderOrderScreen(game, names, finalOrder, [])
    maybeRecord(game, orderNames)
  } else {
    singleRun!.drawn.push(finalOrder[0])
    showSingleResult()
    maybeRecord(singleRun!.game, singleRun!.drawn.map((p) => p.name))
  }
}

function showSingleResult(): void {
  const run = singleRun!
  const remaining = run.present.filter((n) => !run.drawn.some((d) => d.name === n))
  // persiste l'état du daily « Une personne » pour pouvoir le reprendre (sans toucher au journal)
  session = {
    date: todayKey(),
    game: run.game.id,
    mode: 'single',
    journal: session?.journal ?? 'pending',
    order: [],
    done: [],
    drawn: run.drawn.map((p) => p.name),
    present: run.present,
  }
  if (remaining.length === 0) clearSession(saved)
  else saveSession(saved, session)
  renderSingleResult(app, {
    drawn: run.drawn,
    remaining: remaining.length,
    timeboxSec: saved.timeboxSec,
    onTimeUp: () => sfx.timeUp(),
    onSpeakTime: (name, sec) => recordSpeakTime(saved, name, sec),
    onNext: async () => {
      if (remaining.length === 1) {
        // plus de suspense nécessaire : la dernière personne passe d'office
        run.drawn.push((await toParticipants(remaining))[0])
        showSingleResult()
        maybeRecord(run.game, run.drawn.map((p) => p.name))
      } else {
        void runGame(run.game, remaining, 'single', false)
      }
    },
    onHome: showHome,
  })
}

/** true tant que tout le monde n'est pas passé (session reprenable). */
function isIncomplete(s: ActiveSession): boolean {
  return s.mode === 'order' ? s.done.length < s.order.length : s.drawn.length < s.present.length
}

/** Reprend un daily en cours à la réouverture : on rouvre directement l'écran de passage. */
async function resumeSession(s: ActiveSession): Promise<void> {
  session = s
  const game = GAMES.find((g) => g.id === s.game)
  if (!game) return showHome()
  if (s.mode === 'order') {
    const order = await toParticipants(s.order)
    renderOrderScreen(game, s.order, order, s.done)
  } else {
    singleRun = { game, present: s.present, drawn: await toParticipants(s.drawn) }
    showSingleResult()
  }
}

function boot(): void {
  const s = saved.session
  if (s && s.date === todayKey() && isIncomplete(s)) {
    void resumeSession(s)
  } else {
    if (s) clearSession(saved) // session terminée ou périmée → on nettoie
    showHome()
  }
}

boot()
