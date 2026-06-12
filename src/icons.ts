import type { IconNode } from 'lucide'

export function icon(node: IconNode, size = 18): string {
  const children = node
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ')
      return `<${tag} ${attrStr}/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`
}

export {
  ArrowLeft,
  BookOpen,
  Check,
  CircleCheck,
  ClipboardList,
  Crown,
  Dice6,
  Download,
  Flower2,
  Ghost,
  House,
  Leaf,
  Maximize,
  Mic,
  Minimize,
  Moon,
  Pencil,
  Settings,
  Snowflake,
  Star,
  Sun,
  Target,
  Timer,
  TreePine,
  Trophy,
  Upload,
  Users,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide'
