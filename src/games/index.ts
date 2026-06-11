import type { GameDef } from '../types'
import { race } from './race'
import { plinko } from './plinko'
import { ladder } from './ladder'
import { airdrop } from './airdrop'
import { cannon } from './cannon'
import { wheel } from './wheel'
import { slot } from './slot'
import { battle } from './battle'
import { potato } from './potato'
import { cards } from './cards'
import { claw } from './claw'
import { chairs } from './chairs'

export const GAMES: GameDef[] = [
  // trajectoires & classement
  race,
  plinko,
  ladder,
  airdrop,
  cannon,
  wheel,
  // suspense & élimination
  slot,
  battle,
  potato,
  cards,
  claw,
  chairs,
]

export const FAMILIES: { key: GameDef['family']; label: string }[] = [
  { key: 'rank', label: 'Trajectoires & classement' },
  { key: 'elim', label: 'Suspense & élimination' },
]
