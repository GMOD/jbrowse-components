import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export interface MultiSyntenyRenderOpts {
  width: number
  height: number
  rowHeight: number
  bpPerPx: number
  offsetPx: number
  colorBy: string
  labelW: number
}

export interface MultiSyntenyBackend {
  resize(width: number, height: number): void
  render(
    genomeRows: Map<string, MultiPairFeature[]>,
    displayedGenomes: string[],
    opts: MultiSyntenyRenderOpts,
  ): void
  dispose(): void
}
