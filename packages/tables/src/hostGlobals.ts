import { installBareHostGlobals } from './bareHost.ts'

import type { ReadRange } from './bareHost.ts'

// Imported first by the bundle, so the globals exist before any module that
// reads one at load. The host defines `jbrowseHost.readRange` before or after
// loading the bundle; it is looked up per read.
installBareHostGlobals((url, start, end) =>
  (
    globalThis as unknown as { jbrowseHost: { readRange: ReadRange } }
  ).jbrowseHost.readRange(url, start, end),
)
