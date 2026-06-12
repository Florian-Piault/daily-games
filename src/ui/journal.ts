import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { colorFor } from '../avatars'
import { GAMES } from '../games'
import { icon, ArrowLeft, BookOpen } from '../icons'
import type { SavedState } from '../state'
import { escapeHtml } from './esc'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
)

export interface JournalOpts {
  saved: SavedState
  onHome: () => void
}

const CHART_DAYS = 14
const LIST_MAX = 20

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function fmtDur(s: number): string {
  s = Math.round(s)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`
  if (m) return `${m} min ${String(sec).padStart(2, '0')} s`
  return `${sec} s`
}

/** Écran journal : positions de passage, temps de parole par jour et total, derniers tirages. */
export function renderJournal(app: HTMLElement, opts: JournalOpts): void {
  const entries = [...opts.saved.history].sort((a, b) => a.date.localeCompare(b.date))
  const recent = entries.slice(-CHART_DAYS)
  const recentSpoken = recent.filter((e) => e.speak && Object.keys(e.speak).length)

  const totals = new Map<string, number>()
  for (const e of entries) {
    for (const [name, sec] of Object.entries(e.speak ?? {})) {
      totals.set(name, (totals.get(name) ?? 0) + sec)
    }
  }
  const totalRows = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const maxTotal = totalRows[0]?.[1] ?? 0

  app.innerHTML = `
  <div class="screen result">
    <header class="topbar">
      <button class="btn icon" id="home" title="Accueil">${icon(ArrowLeft)}</button>
      <h1>${icon(BookOpen)} Journal du daily</h1>
      <span class="topbar-spacer"></span>
    </header>
    <main class="journal-main">
      ${
        recent.length
          ? `<h3>Ordre de passage</h3>
      <div class="chart-card"><canvas id="order-chart"></canvas></div>`
          : '<p class="hint">Aucun tirage enregistré pour l’instant — lance un jeu et reviens ici.</p>'
      }
      ${
        recentSpoken.length
          ? `<h3>Temps de parole par jour</h3>
      <div class="chart-card"><canvas id="speak-chart"></canvas></div>`
          : ''
      }
      ${
        totalRows.length
          ? `<h3>Temps de parole total</h3>
      <ul class="totals-list">
        ${totalRows
          .map(
            ([name, sec]) => `
        <li class="total-row">
          <span class="total-name">${escapeHtml(name)}</span>
          <div class="total-bar-wrap"><div class="total-bar" style="width:${(sec / maxTotal) * 100}%;background:${colorFor(name)}"></div></div>
          <span class="total-time">${fmtDur(sec)}</span>
        </li>`,
          )
          .join('')}
      </ul>`
          : ''
      }
      ${
        entries.length
          ? `<h3>Derniers tirages</h3>
      <ul class="journal-list">
        ${entries
          .slice(-LIST_MAX)
          .reverse()
          .map((e) => {
            const game = GAMES.find((g) => g.id === e.game)
            return `
        <li class="journal-row">
          <span class="journal-date">${fmtDate(e.date)}</span>
          <span class="journal-game">${game ? `${game.emoji} ${game.name}` : escapeHtml(e.game)}</span>
          <span class="journal-order"><b>${escapeHtml(e.order[0] ?? '')}</b>${e.order
            .slice(1)
            .map((n) => ` → ${escapeHtml(n)}`)
            .join('')}</span>
        </li>`
          })
          .join('')}
      </ul>`
          : ''
      }
    </main>
  </div>`

  const charts: Chart[] = []
  const styles = getComputedStyle(document.documentElement)
  const textColor = styles.getPropertyValue('--muted').trim()
  const gridColor = styles.getPropertyValue('--card-border').trim()
  const axis = (extra: object = {}) => ({
    ticks: { color: textColor },
    grid: { color: gridColor },
    ...extra,
  })

  const orderCanvas = app.querySelector<HTMLCanvasElement>('#order-chart')
  if (orderCanvas && recent.length) {
    const names = new Set<string>()
    recent.forEach((e) => e.order.forEach((n) => names.add(n)))
    charts.push(
      new Chart(orderCanvas, {
        type: 'line',
        data: {
          labels: recent.map((e) => fmtDate(e.date)),
          datasets: [...names].map((name) => ({
            label: name,
            data: recent.map((e) => {
              const i = e.order.indexOf(name)
              return i === -1 ? null : i + 1
            }),
            borderColor: colorFor(name),
            backgroundColor: colorFor(name),
            spanGaps: false,
            tension: 0.25,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          color: textColor,
          scales: {
            y: axis({
              reverse: true,
              min: 1,
              ticks: { stepSize: 1, color: textColor },
              title: { display: true, text: 'Position de passage', color: textColor },
            }),
            x: axis(),
          },
          plugins: { legend: { labels: { color: textColor } } },
        },
      }),
    )
  }

  const speakCanvas = app.querySelector<HTMLCanvasElement>('#speak-chart')
  if (speakCanvas && recentSpoken.length) {
    const names = new Set<string>()
    recentSpoken.forEach((e) => Object.keys(e.speak!).forEach((n) => names.add(n)))
    charts.push(
      new Chart(speakCanvas, {
        type: 'bar',
        data: {
          labels: recentSpoken.map((e) => fmtDate(e.date)),
          datasets: [...names].map((name) => ({
            label: name,
            data: recentSpoken.map((e) => e.speak![name] ?? 0),
            backgroundColor: colorFor(name),
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          color: textColor,
          scales: {
            y: axis({
              stacked: true,
              ticks: { color: textColor, callback: (v: unknown) => fmtDur(Number(v)) },
            }),
            x: axis({ stacked: true }),
          },
          plugins: {
            legend: { labels: { color: textColor } },
            tooltip: {
              callbacks: {
                label: (item) => `${item.dataset.label} : ${fmtDur(Number(item.raw))}`,
              },
            },
          },
        },
      }),
    )
  }

  app.querySelector('#home')!.addEventListener('click', () => {
    charts.forEach((c) => c.destroy())
    opts.onHome()
  })
}
