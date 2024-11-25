import { getContainingView, getSession } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { reaction, autorun } from 'mobx'
import { addDisposer, getSnapshot } from 'mobx-state-tree'

// locals
import { drawMouseoverSynteny, drawRef } from './drawSynteny'
import type { LinearSyntenyDisplayModel } from './model'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model'
import type { Feature } from '@jbrowse/core/util'

interface Pos {
  offsetPx: number
}

interface FeatPos {
  p11: Pos
  p12: Pos
  p21: Pos
  p22: Pos
  f: Feature
  cigar: string[]
}

type LSV = LinearSyntenyViewModel

export function doAfterAttach(self: LinearSyntenyDisplayModel) {
  addDisposer(
    self,
    autorun(() => {
      const view = getContainingView(self) as LinearSyntenyViewModel
      if (!view.initialized) {
        return
      }
      const ctx1 = self.mainCanvas?.getContext('2d')
      const ctx3 = self.cigarClickMapCanvas?.getContext('2d')
      if (!ctx1 || !ctx3) {
        return
      }

      const height = self.height
      const width = view.width
      ctx1.clearRect(0, 0, width, height)
      ctx3.clearRect(0, 0, width, height)
      drawRef(self, ctx1, ctx3)
    }),
  )

  addDisposer(
    self,
    autorun(() => {
      const view = getContainingView(self) as LinearSyntenyViewModel
      if (!view.initialized) {
        return
      }
      drawMouseoverSynteny(self)
    }),
  )

  // this attempts to reduce recalculation of feature positions drawn by
  // the synteny view
  //
  // uses a reaction to say "we know the positions don't change in any
  // relevant way unless bpPerPx changes or displayedRegions changes"
  addDisposer(
    self,
    reaction(
      () => {
        const view = getContainingView(self) as LSV
        return {
          bpPerPx: view.views.map(v => v.bpPerPx),

          // stringifying 'deeply' accesses the displayed regions, see
          // issue #3456
          displayedRegions: JSON.stringify(
            view.views.map(v => v.displayedRegions),
          ),
          features: self.features,
          initialized: view.initialized,
        }
      },
      ({ initialized }) => {
        if (!initialized) {
          return
        }
        const { level } = self
        const { assemblyManager } = getSession(self)
        const view = getContainingView(self) as LSV
        const viewSnaps = view.views.map(view => ({
          ...getSnapshot(view),
          width: view.width,
          staticBlocks: view.staticBlocks,
          interRegionPaddingWidth: view.interRegionPaddingWidth,
          minimumBlockWidth: view.minimumBlockWidth,
        }))

        const map = [] as FeatPos[]
        const feats = self.features || []

        for (const f of feats) {
          const mate = f.get('mate')
          let f1s = f.get('start')
          let f1e = f.get('end')
          const f2s = mate.start
          const f2e = mate.end

          if (f.get('strand') === -1) {
            ;[f1e, f1s] = [f1s, f1e]
          }
          const a1 = assemblyManager.get(f.get('assemblyName'))
          const a2 = assemblyManager.get(mate.assemblyName)
          const r1 = f.get('refName')
          const r2 = mate.refName
          const ref1 = a1?.getCanonicalRefName(r1) || r1
          const ref2 = a2?.getCanonicalRefName(r2) || r2
          const v1 = viewSnaps[level]!
          const v2 = viewSnaps[level + 1]!
          const p11 = bpToPx({ self: v1, refName: ref1, coord: f1s })
          const p12 = bpToPx({ self: v1, refName: ref1, coord: f1e })
          const p21 = bpToPx({ self: v2, refName: ref2, coord: f2s })
          const p22 = bpToPx({ self: v2, refName: ref2, coord: f2e })

          if (
            p11 === undefined ||
            p12 === undefined ||
            p21 === undefined ||
            p22 === undefined
          ) {
            continue
          }

          const cigar = f.get('CIGAR') as string | undefined
          map.push({
            p11,
            p12,
            p21,
            p22,
            f,
            cigar: MismatchParser.parseCigar(cigar),
          })
        }

        self.setFeatPositions(map)
      },
      { fireImmediately: true },
    ),
  )
}
