import { installGlobalFetchAutorun } from '@jbrowse/plugin-linear-genome-view'

interface LDModel {
  showLDTriangle: boolean
  regionTooLarge: boolean
  isMinimized: boolean
  reloadCounter: number
  rpcProps(): Record<string, unknown>
  performLDFetch(): void
}

export function doAfterAttach(self: LDModel) {
  // A force-load (raising userByteSizeLimit) also clears regionTooLarge and
  // bumps reloadCounter, so the byte limit needs no tracker of its own — either
  // of those (already tracked) refires the fetch.
  installGlobalFetchAutorun(self, {
    shouldFetch: () => self.showLDTriangle && !self.regionTooLarge,
    fetch: () => {
      self.performLDFetch()
    },
    delay: 500,
    name: 'LDDisplayRender',
  })
}
