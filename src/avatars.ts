import { createAvatar } from '@dicebear/core'
import { funEmoji } from '@dicebear/collection'

const uriCache = new Map<string, string>()
const imgCache = new Map<string, HTMLImageElement>()

/** Variantes d'avatar par membre (référence partagée avec l'état sauvegardé). */
let variants: Record<string, number> = {}

export function initAvatarVariants(v: Record<string, number>): void {
  variants = v
}

/** Génère une nouvelle variante d'avatar ; l'appelant persiste l'état. */
export function rerollAvatar(name: string): void {
  variants[name] = (variants[name] ?? 0) + 1
}

function seedFor(name: string): string {
  const n = variants[name] ?? 0
  return n ? `${name}#${n}` : name
}

export function avatarUri(name: string): string {
  const seed = seedFor(name)
  let uri = uriCache.get(seed)
  if (!uri) {
    const svg = createAvatar(funEmoji, { seed, size: 128, radius: 50 }).toString()
    uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
    uriCache.set(seed, uri)
  }
  return uri
}

export function avatarFor(name: string): Promise<HTMLImageElement> {
  const seed = seedFor(name)
  const cached = imgCache.get(seed)
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      imgCache.set(seed, img)
      resolve(img)
    }
    img.onerror = reject
    img.src = avatarUri(name)
  })
}

export function colorFor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + (c.codePointAt(0) ?? 0)) % 360
  return `hsl(${h} 75% 62%)`
}
