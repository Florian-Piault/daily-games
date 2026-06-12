import {
	icon,
	Download,
	Flower2,
	Ghost,
	Leaf,
	Moon,
	Settings,
	Snowflake,
	Sun,
	TreePine,
	Upload,
	Waves,
} from '../icons'
import {
	DEFAULT_PACE,
	exportStateJson,
	parseImportedState,
	saveState,
	todayKey,
	type SavedState,
	type ThemeKey,
} from '../state'
import { DEFAULT_SUSPENSE, type GameStage, type IntroKind, type Pace, type SuspenseConfig } from '../types'
import { GAMES } from '../games'
import { openModal } from './modal'

interface Row {
	key: keyof Pace
	label: string
	hint: string
}

const SUSPENSE_FX: { key: keyof SuspenseConfig; label: string }[] = [
	{ key: 'nearMiss', label: 'Faux-suspense' },
	{ key: 'slowdown', label: 'Ralenti' },
	{ key: 'surprises', label: 'Surprises' },
	{ key: 'camera', label: 'Secousses' },
]

interface StageOption {
	value: string
	label: string
}

const INTRO_OPTIONS: StageOption[] = [
	{ value: 'none', label: 'Sans intro' },
	{ value: 'presentation', label: 'Présentation' },
	{ value: 'countdown', label: 'Décompte' },
	{ value: 'announcer', label: 'Annonceur' },
]

// Format proposé par jeu (seule la machine à sous en a un pour l'instant).
const FORMAT_OPTIONS: Record<string, StageOption[]> = {
	slot: [
		{ value: 'reels1', label: '1 rouleau' },
		{ value: 'reels3', label: '3 rouleaux' },
	],
}

// Jeux dont la mise en scène (intro + format) se règle ici.
const STAGE_GAMES = ['wheel', 'slot']
	.map((id) => GAMES.find((g) => g.id === id))
	.filter((g): g is (typeof GAMES)[number] => !!g)

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

const TIMEBOX_STEPS = [
	{ label: 'Off', value: 0 },
	{ label: '1 min', value: 60 },
	{ label: '2 min', value: 120 },
	{ label: '3 min', value: 180 },
]

const THEMES: { key: ThemeKey; emoji: string; label: string }[] = [
	{ key: 'dark', emoji: icon(Moon, 20), label: 'Foncé' },
	{ key: 'light', emoji: icon(Sun, 20), label: 'Clair' },
	{ key: 'printemps', emoji: icon(Flower2, 20), label: 'Printemps' },
	{ key: 'ete', emoji: icon(Waves, 20), label: 'Été' },
	{ key: 'automne', emoji: icon(Leaf, 20), label: 'Automne' },
	{ key: 'hiver', emoji: icon(Snowflake, 20), label: 'Hiver' },
	{ key: 'noel', emoji: icon(TreePine, 20), label: 'Noël' },
	{ key: 'halloween', emoji: icon(Ghost, 20), label: 'Halloween' },
]

export function applyTheme(theme: ThemeKey): void {
	document.documentElement.dataset.theme = theme
}

/** Ouvre la modale « Réglages ». Les changements sont sauvegardés immédiatement. */
export function openSettings(saved: SavedState): void {
	const stageSeg = (gameId: string, group: 'intro' | 'format', options: StageOption[]) => `
      <div class="stage-field">
        <span class="stage-field-label">${group === 'intro' ? 'Intro' : 'Format'}</span>
        <div class="seg wrap" data-stage="${gameId}" data-group="${group}">
          ${options.map((o) => `<button type="button" class="seg-btn" data-value="${o.value}">${o.label}</button>`).join('')}
        </div>
      </div>`

	const stageBlock = STAGE_GAMES.map(
		(g) => `
      <div class="stage-game">
        <span class="stage-game-name">${g.emoji} ${g.name}</span>
        ${stageSeg(g.id, 'intro', INTRO_OPTIONS)}
        ${FORMAT_OPTIONS[g.id] ? stageSeg(g.id, 'format', FORMAT_OPTIONS[g.id]) : ''}
      </div>`,
	).join('')

	const { dialog } = openModal({
		labelledBy: 'settings-title',
		titleHtml: `${icon(Settings)} Réglages`,
		bodyHtml: `
    <div class="setting-label">
      <span>Thème</span>
    </div>
    <div class="theme-grid" id="theme-grid">
      ${THEMES.map(
			(t) => `
      <button type="button" class="theme-btn" data-theme="${t.key}">
        <span class="theme-emoji">${t.emoji}</span>
        <span>${t.label}</span>
      </button>`,
		).join('')}
    </div>
    <div class="setting-row">
      <div class="setting-label">
        <span>Time-box</span>
        <span class="hint">temps de parole par personne</span>
      </div>
      <div class="seg" id="timebox-seg">
        ${TIMEBOX_STEPS.map((s) => `<button type="button" class="seg-btn" data-value="${s.value}">${s.label}</button>`).join('')}
      </div>
    </div>
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
    <div class="setting-label">
      <span>Mise en scène</span>
      <span class="hint">intro &amp; format de la roue et de la machine à sous</span>
    </div>
    <div class="stage-config">${stageBlock}</div>
    <div class="setting-label">
      <span>Effets de suspense</span>
      <span class="hint">roue &amp; machine à sous — clique pour activer/couper</span>
    </div>
    <div class="seg wrap" id="suspense-seg">
      ${SUSPENSE_FX.map((fx) => `<button type="button" class="seg-btn" data-fx="${fx.key}">${fx.label}</button>`).join('')}
    </div>
    <footer class="modal-foot">
      <button class="btn" id="settings-reset">Réinitialiser</button>
    </footer>
    <div class="setting-row data-row">
      <div class="setting-label">
        <span>Données</span>
        <span class="hint">sauvegarde locale : équipe, historique, réglages</span>
      </div>
      <div class="data-actions">
        <button type="button" class="btn" id="data-export">${icon(Download, 16)} Exporter</button>
        <button type="button" class="btn" id="data-import">${icon(Upload, 16)} Importer</button>
        <input type="file" id="data-file" accept="application/json,.json" hidden />
      </div>
    </div>
    <p class="hint" id="data-msg" role="status" aria-live="polite"></p>`,
	})

	function sync() {
		dialog.querySelectorAll<HTMLDivElement>('.seg[data-key]').forEach((seg) => {
			const value = saved.pace[seg.dataset.key as keyof Pace]
			seg.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((b) => {
				b.classList.toggle('active', Number(b.dataset.value) === value)
			})
		})
		dialog.querySelectorAll<HTMLButtonElement>('#timebox-seg .seg-btn').forEach((b) => {
			b.classList.toggle('active', Number(b.dataset.value) === saved.timeboxSec)
		})
		dialog.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((b) => {
			b.classList.toggle('active', b.dataset.theme === saved.theme)
		})
		dialog.querySelectorAll<HTMLButtonElement>('#suspense-seg .seg-btn').forEach((b) => {
			b.classList.toggle('active', saved.suspense[b.dataset.fx as keyof SuspenseConfig])
		})
		dialog.querySelectorAll<HTMLDivElement>('.seg[data-stage]').forEach((seg) => {
			const prefs = saved.stagePrefs[seg.dataset.stage!]
			const current =
				seg.dataset.group === 'intro' ? (prefs?.intro ?? 'none') : (prefs?.format ?? 'reels1')
			seg.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((b) => {
				b.classList.toggle('active', b.dataset.value === current)
			})
		})
	}

	dialog.querySelectorAll<HTMLDivElement>('.seg[data-key]').forEach((seg) => {
		const key = seg.dataset.key as keyof Pace
		seg.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((b) => {
			b.addEventListener('click', () => {
				saved.pace[key] = Number(b.dataset.value)
				saveState(saved)
				sync()
			})
		})
	})

	dialog.querySelectorAll<HTMLButtonElement>('#timebox-seg .seg-btn').forEach((b) => {
		b.addEventListener('click', () => {
			saved.timeboxSec = Number(b.dataset.value)
			saveState(saved)
			sync()
		})
	})

	dialog.querySelectorAll<HTMLButtonElement>('.theme-btn').forEach((b) => {
		b.addEventListener('click', () => {
			saved.theme = b.dataset.theme as ThemeKey
			applyTheme(saved.theme)
			saveState(saved)
			sync()
		})
	})

	dialog.querySelectorAll<HTMLButtonElement>('#suspense-seg .seg-btn').forEach((b) => {
		b.addEventListener('click', () => {
			const fx = b.dataset.fx as keyof SuspenseConfig
			saved.suspense[fx] = !saved.suspense[fx]
			saveState(saved)
			sync()
		})
	})

	dialog.querySelectorAll<HTMLDivElement>('.seg[data-stage]').forEach((seg) => {
		const id = seg.dataset.stage!
		const group = seg.dataset.group as 'intro' | 'format'
		seg.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((b) => {
			b.addEventListener('click', () => {
				const cur: GameStage = saved.stagePrefs[id] ?? { intro: 'none' }
				saved.stagePrefs[id] =
					group === 'intro'
						? { ...cur, intro: b.dataset.value as IntroKind }
						: { ...cur, format: b.dataset.value }
				saveState(saved)
				sync()
			})
		})
	})

	dialog.querySelector('#settings-reset')!.addEventListener('click', () => {
		saved.pace = { ...DEFAULT_PACE }
		saved.timeboxSec = 0
		saved.suspense = { ...DEFAULT_SUSPENSE }
		saveState(saved)
		sync()
	})

	const msg = dialog.querySelector<HTMLParagraphElement>('#data-msg')!

	dialog.querySelector('#data-export')!.addEventListener('click', () => {
		const blob = new Blob([exportStateJson(saved)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `daily-games-backup-${todayKey()}.json`
		a.click()
		URL.revokeObjectURL(url)
		msg.textContent = 'Sauvegarde exportée.'
	})

	const fileInput = dialog.querySelector<HTMLInputElement>('#data-file')!
	dialog.querySelector('#data-import')!.addEventListener('click', () => fileInput.click())
	fileInput.addEventListener('change', async () => {
		const file = fileInput.files?.[0]
		fileInput.value = '' // permet de réimporter le même fichier
		if (!file) return
		const imported = parseImportedState(await file.text())
		if (!imported) {
			msg.textContent = 'Fichier invalide : sauvegarde non reconnue.'
			return
		}
		if (!confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return
		saveState(imported)
		location.reload()
	})

	sync()
}
