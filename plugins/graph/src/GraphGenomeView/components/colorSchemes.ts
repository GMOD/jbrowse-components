import type { ColorScheme } from '../types.ts'

export const COLOR_SCHEME_OPTIONS: { value: ColorScheme; label: string }[] = [
  { value: 'uniform', label: 'Uniform' },
  { value: 'random', label: 'Random' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'depth', label: 'Depth' },
  { value: 'node-length', label: 'Node Length' },
  { value: 'grey', label: 'Grey' },
]
