import { icon, Maximize, Minimize } from '../icons'

/** Câble un bouton à l'API Fullscreen : bascule au clic, icône resynchronisée sur `fullscreenchange`. */
export function wireFullscreenButton(btn: HTMLButtonElement): void {
  const render = () => {
    btn.innerHTML = document.fullscreenElement ? icon(Minimize) : icon(Maximize)
  }
  btn.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  })
  const onChange = () => {
    if (!btn.isConnected) return document.removeEventListener('fullscreenchange', onChange)
    render()
  }
  document.addEventListener('fullscreenchange', onChange)
  render()
}
