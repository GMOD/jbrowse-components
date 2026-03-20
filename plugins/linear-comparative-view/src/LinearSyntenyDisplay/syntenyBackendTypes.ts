import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

export interface SyntenyBackend {
  resize(width: number, height: number): void
  uploadGeometry(data: SyntenyInstanceData): void
  render(
    offset0: number,
    offset1: number,
    height: number,
    curBpPerPx0: number,
    curBpPerPx1: number,
    maxOffScreenPx: number,
    minAlignmentLength: number,
    alpha: number,
    hoveredFeatureId: number,
    clickedFeatureId: number,
  ): void
  pick(
    x: number,
    y: number,
    onResult?: (result: number) => void,
  ): number | undefined
  dispose(): void
}
