import type { options } from './command.ts'
import type { parseArgs } from 'node:util'

export { aggregateIndex } from './aggregate.ts'
export { perTrackIndex } from './per-track.ts'
export { indexFileList } from './file-list.ts'
export { run } from './command.ts'

export type TextIndexFlags = ReturnType<
  typeof parseArgs<{ options: typeof options }>
>['values']
