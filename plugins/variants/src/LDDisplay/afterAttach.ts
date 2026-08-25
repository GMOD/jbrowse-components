import { installGlobalFetchAutorun } from '@jbrowse/display-kit/installGlobalFetchAutorun'

import { ldFetchPhases } from './ldFetchPhases.ts'

import type { LDFetchSelf } from './ldFetchPhases.ts'
import type { GlobalFetchAutorunHost } from '@jbrowse/display-kit/installGlobalFetchAutorun'

// The skeleton's own hosting requirements (`GlobalFetchAutorunHost`, the
// interface the skeleton itself is typed against) on top of what the fetch
// phases need.
export function doAfterAttach(self: LDFetchSelf & GlobalFetchAutorunHost) {
  // `reload()` refires through `reloadCounter`, which the skeleton reads above
  // the phases.
  installGlobalFetchAutorun(self, {
    ...ldFetchPhases(self),
    delay: 500,
    name: 'LDDisplayRender',
  })
}
