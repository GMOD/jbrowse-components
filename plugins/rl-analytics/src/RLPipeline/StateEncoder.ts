import type { BrowserState, TaskConfig } from './types.ts'

export default class StateEncoder {
  extractState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    view: any,
    lastActionTimestamp: number,
    recentActionCount: number,
    taskConfig?: TaskConfig,
  ): BrowserState {
    const bpPerPx: number = view.bpPerPx ?? 1
    const offsetPx: number = view.offsetPx ?? 0
    const viewWidthPx: number = view.width ?? 800
    const viewportBp = bpPerPx * viewWidthPx

    const displayedRegions = view.displayedRegions ?? []
    const firstRegion = displayedRegions[0] ?? {
      assemblyName: '',
      refName: '',
      start: 0,
      end: 0,
    }

    const tracks = view.tracks ?? []
    const activeTracks: string[] = tracks.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => t.configuration?.trackId ?? '',
    )

    let taskActive = false
    let distanceToTargetBp: number | undefined
    let targetVisible: boolean | undefined
    let targetFullyVisible: boolean | undefined

    if (taskConfig?.target) {
      taskActive = true
      const viewCenterBp =
        firstRegion.start + viewportBp / 2
      const targetCenter =
        (taskConfig.target.start + taskConfig.target.end) / 2

      if (firstRegion.refName === taskConfig.target.refName) {
        distanceToTargetBp = targetCenter - viewCenterBp
      }

      const contentBlocks = view.dynamicBlocks?.contentBlocks ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      targetVisible = contentBlocks.some((block: any) =>
        block.refName === taskConfig.target!.refName &&
        block.start <= taskConfig.target!.end &&
        block.end >= taskConfig.target!.start,
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      targetFullyVisible = contentBlocks.some((block: any) =>
        block.refName === taskConfig.target!.refName &&
        block.start <= taskConfig.target!.start &&
        block.end >= taskConfig.target!.end,
      )
    }

    return {
      bpPerPx,
      offsetPx,
      viewWidthPx,
      assemblyName: firstRegion.assemblyName,
      refName: firstRegion.refName,
      startBp: firstRegion.start,
      endBp: firstRegion.end,
      viewportBp,
      activeTracks,
      numTracks: activeTracks.length,
      taskActive,
      targetRefName: taskConfig?.target?.refName,
      targetStartBp: taskConfig?.target?.start,
      targetEndBp: taskConfig?.target?.end,
      distanceToTargetBp,
      targetVisible,
      targetFullyVisible,
      timeSinceLastAction:
        lastActionTimestamp > 0 ? Date.now() - lastActionTimestamp : 0,
      actionsInLast5Seconds: recentActionCount,
    }
  }

  encode(state: BrowserState): number[] {
    return [
      Math.log(state.bpPerPx),
      state.offsetPx / 1000,
      state.viewWidthPx / 1000,
      state.viewportBp / 1e6,
      state.numTracks / 10,
      state.taskActive ? 1 : 0,
      state.distanceToTargetBp
        ? Math.sign(state.distanceToTargetBp) *
          Math.log1p(Math.abs(state.distanceToTargetBp))
        : 0,
      state.targetVisible ? 1 : 0,
      state.targetFullyVisible ? 1 : 0,
      Math.log1p(state.timeSinceLastAction),
      state.actionsInLast5Seconds / 10,
    ]
  }

  get dimensions(): number {
    return 11
  }
}
