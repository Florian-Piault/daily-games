import { createAvatar } from '@dicebear/core'
import { funEmoji } from '@dicebear/collection'

const uriCache = new Map<string, string>()
const imgCache = new Map<string, HTMLImageElement>()

export function avatarUri(name: string): string {
  let uri = uriCache.get(name)
  if (!uri) {
    const svg = createAvatar(funEmoji, { seed: name, size: 128, radius: 50 }).toString()
    uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
    uriCache.set(name, uri)
  }
  return uri
}

export function avatarFor(name: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(name)
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      imgCache.set(name, img)
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
