import type { Register } from 'claude-code'
import { register as vuelta } from './vuelta'
import { register as salaLimpia } from './sala-limpia'

// A plugin loads one hooks module: this one hands the same `on` to each of the plugin's mods, which stay in their
// own files and know nothing of each other.
export const register: Register = (on, options) => {
  vuelta(on, options)
  salaLimpia(on, options)
}
