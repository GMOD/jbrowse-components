import { getContainingView, getSession } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { addDisposer, getSnapshot } from '@jbrowse/mobx-state-tree'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { autorun, reaction } from 'mobx'

import { drawMouseoverClickMap, drawRef, drawCigarClickMap } from './drawSynteny'
import { serializeFeatPos } from './model'

import type { LinearSyntenyDisplayModel } from './model'
import type {
  DrawResultMessage,
  DrawSyntenyMessage,
  UpdateFeaturesMessage,
} from './syntenyRendererWorker'
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
  let renderingTimeout: ReturnType<typeof setTimeout> | undefined

  // Worker lifecycle management - create/destroy based on useWebWorker setting
  addDisposer(
    self,
    reaction(
      () => {
        const view = getContainingView(self) as LSV
        return view.useWebWorker
      },
      useWebWorker => {
        // Terminate existing worker if any
        if (self.worker) {
          self.worker.terminate()
          self.setWorker(null)
        }

        // Create new worker if enabled and OffscreenCanvas is available
        if (useWebWorker && typeof OffscreenCanvas !== 'undefined') {
          const worker = new Worker(
            new URL('./syntenyRendererWorker', import.meta.url),
          )

          worker.onmessage = (e: MessageEvent<DrawResultMessage>) => {
            clearTimeout(renderingTimeout)
            renderingTimeout = undefined
            self.setIsRendering(false)

            const mainCtx = self.mainCanvas?.getContext('2d')
            if (mainCtx) {
              mainCtx.globalCompositeOperation = 'copy'
              mainCtx.drawImage(e.data.mainBitmap, 0, 0)
              mainCtx.globalCompositeOperation = 'source-over'
              e.data.mainBitmap.close()
            }

            const clickMapCtx = self.clickMapCanvas?.getContext('2d')
            if (clickMapCtx && self.clickMapCanvas) {
              clickMapCtx.clearRect(
                0,
                0,
                self.clickMapCanvas.width,
                self.clickMapCanvas.height,
              )
              clickMapCtx.drawImage(e.data.clickMapBitmap, 0, 0)
              e.data.clickMapBitmap.close()
            }

            const cigarClickMapCtx = self.cigarClickMapCanvas?.getContext('2d')
            if (cigarClickMapCtx && self.cigarClickMapCanvas) {
              cigarClickMapCtx.clearRect(
                0,
                0,
                self.cigarClickMapCanvas.width,
                self.cigarClickMapCanvas.height,
              )
              cigarClickMapCtx.drawImage(e.data.cigarClickMapBitmap, 0, 0)
              e.data.cigarClickMapBitmap.close()
            }
          }

          // Wrap postMessage to track rendering state
          const originalPostMessage = worker.postMessage.bind(worker)
          // @ts-expect-error
          worker.postMessage = (message: unknown, transfer?: Transferable[]) => {
            if (
              typeof message === 'object' &&
              message !== null &&
              'type' in message &&
              message.type === 'draw'
            ) {
              clearTimeout(renderingTimeout)
              renderingTimeout = setTimeout(() => {
                self.setIsRendering(true)
              }, 50)
            }
            if (transfer) {
              originalPostMessage(message, transfer)
            } else {
              originalPostMessage(message)
            }
          }

          self.setWorker(worker)
        }
      },
      { fireImmediately: true },
    ),
  )

  // Cleanup worker on dispose
  addDisposer(self, () => {
    clearTimeout(renderingTimeout)
    if (self.worker) {
      self.worker.terminate()
      self.setWorker(null)
    }
  })

  // Autorun to send features to worker when they change
  addDisposer(
    self,
    autorun(
      function syntenyUpdateFeaturesAutorun() {
        const { worker, featPositions } = self
        if (!worker || featPositions.length === 0) {
          return
        }

        const message: UpdateFeaturesMessage = {
          type: 'updateFeatures',
          featPositions: featPositions.map(serializeFeatPos),
        }

        worker.postMessage(message)
      },
      { name: 'SyntenyUpdateFeatures' },
    ),
  )

  // Autorun to trigger drawing when view parameters change
  addDisposer(
    self,
    autorun(
      function syntenyDrawAutorun() {
        const view = getContainingView(self) as LinearSyntenyViewModel
        if (
          !view.initialized ||
          !view.views.every(a => a.displayedRegions.length > 0 && a.initialized)
        ) {
          return
        }

        const { worker, featPositions, alpha, minAlignmentLength, colorBy } =
          self
        if (!worker || featPositions.length === 0) {
          return
        }

        const height = self.height
        const width = view.width

        const message: DrawSyntenyMessage = {
          type: 'draw',
          width,
          height,
          level: self.level,
          offsets: view.views.map(v => v.offsetPx),
          bpPerPxs: view.views.map(v => v.bpPerPx),
          drawCurves: view.drawCurves,
          drawCIGAR: view.drawCIGAR,
          drawCIGARMatchesOnly: view.drawCIGARMatchesOnly,
          drawLocationMarkers: view.drawLocationMarkers,
          alpha,
          minAlignmentLength,
          colorBy,
        }

        worker.postMessage(message)
      },
      { name: 'SyntenyDraw' },
    ),
  )

  // this attempts to reduce recalculation of feature positions drawn by the
  // synteny view
  //
  // uses a reaction to say "we know the positions don't change in any relevant
  // way unless bpPerPx changes or displayedRegions changes"
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
          initialized:
            view.initialized &&
            view.views.every(
              a => a.displayedRegions.length > 0 && a.initialized,
            ),
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
      {
        fireImmediately: true,
      },
    ),
  )

  // Main-thread rendering when web worker is disabled
  addDisposer(
    self,
    autorun(
      function syntenyMainThreadDrawAutorun() {
        const view = getContainingView(self) as LSV
        if (
          !view.initialized ||
          !view.views.every(a => a.displayedRegions.length > 0 && a.initialized)
        ) {
          return
        }

        // Skip if using web worker
        if (view.useWebWorker) {
          return
        }

        const { featPositions } = self
        if (featPositions.length === 0) {
          return
        }

        const mainCanvas = self.mainCanvas
        const cigarClickMapCanvas = self.cigarClickMapCanvas
        if (!mainCanvas || !cigarClickMapCanvas) {
          return
        }

        const mainCtx = mainCanvas.getContext('2d')
        if (!mainCtx) {
          return
        }

        // Access observables to trigger re-run when they change
        const _alpha = self.alpha
        const _minAlignmentLength = self.minAlignmentLength
        const _colorBy = self.colorBy
        const _drawCurves = view.drawCurves
        const _drawCIGAR = view.drawCIGAR
        const _drawCIGARMatchesOnly = view.drawCIGARMatchesOnly
        const _drawLocationMarkers = view.drawLocationMarkers
        const _offsets = view.views.map(v => v.offsetPx)
        const _bpPerPxs = view.views.map(v => v.bpPerPx)

        const width = view.width
        const height = self.height

        mainCtx.clearRect(0, 0, width, height)
        drawRef(self, mainCtx)
        drawCigarClickMap(self, cigarClickMapCanvas.getContext('2d')!)
      },
      { name: 'SyntenyMainThreadDraw' },
    ),
  )

  // Immediate reaction for mouseover/click changes (user interaction)
  addDisposer(
    self,
    reaction(
      () => ({
        mouseoverId: self.mouseoverId,
        clickId: self.clickId,
        mouseoverCanvas: self.mouseoverCanvas,
        featPositionsLength: self.featPositions.length,
      }),
      ({ mouseoverCanvas, featPositionsLength }) => {
        if (!mouseoverCanvas || featPositionsLength === 0) {
          return
        }
        drawMouseoverClickMap(self)
      },
      { fireImmediately: true },
    ),
  )

  // Debounced reaction for offset changes (during scroll)
  addDisposer(
    self,
    reaction(
      () => {
        const view = getContainingView(self) as LSV
        return {
          offsets: view.views.map(v => v.offsetPx),
          mouseoverCanvas: self.mouseoverCanvas,
          featPositionsLength: self.featPositions.length,
        }
      },
      ({ mouseoverCanvas, featPositionsLength }) => {
        if (!mouseoverCanvas || featPositionsLength === 0) {
          return
        }
        drawMouseoverClickMap(self)
      },
      {
        delay: 100,
        fireImmediately: true,
      },
    ),
  )
}
