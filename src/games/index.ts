import type { GameDef } from '../types'
import { race } from './race'
import { slot } from './slot'
import { plinko } from './plinko'
import { battle } from './battle'

export const GAMES: GameDef[] = [race, slot, plinko, battle]
