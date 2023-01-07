import { types, Instance, addDisposer, getSnapshot } from 'mobx-state-tree'
import {
  getConf,
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'

// locas
import baseModelFactory from '../LinearComparativeDisplay/stateModelFactory'
import { LinearSyntenyViewModel } from '../LinearSyntenyView/model'
import { reaction, autorun } from 'mobx'

type Pos = { offsetPx: number }

interface FeatMap {
  [key: string]: { p11: Pos; p12: Pos; p21: Pos; p22: Pos }
}

/**
 * #stateModel LinearSyntenyDisplay
 * extends `LinearComparativeDisplay` model
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearSyntenyDisplay',
      baseModelFactory(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearSyntenyDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      // canvas used for drawing visible screen
      mainCanvas: null as HTMLCanvasElement | null,

      // canvas used for drawing click map with feature ids
      // this renders a unique color per alignment, so that it can be re-traced
      // after a feature click with getImageData at that pixel
      clickMapCanvas: null as HTMLCanvasElement | null,

      // canvas used for drawing click map with cigar data
      // this can show if you are mousing over a insertion/deletion. it is similar
      // in purpose to the clickMapRef but was not feasible to pack this into the
      // clickMapRef
      cigarClickMapCanvas: null as HTMLCanvasElement | null,

      // canvas for drawing mouseover shading
      // this is separate from the other code for speed: don't have to redraw
      // entire canvas to do a feature's mouseover shading
      mouseoverRef: null as HTMLCanvasElement | null,

      featPositions: {} as FeatMap,
    }))
    .actions(self => ({
      setFeatPositions(arg: FeatMap) {
        self.featPositions = arg
      },
      setMainCanvasRef(ref: HTMLCanvasElement | null) {
        self.mainCanvas = ref
      },
      setClickMapCanvasRef(ref: HTMLCanvasElement | null) {
        self.clickMapCanvas = ref
      },
      setCigarClickMapCanvasRef(ref: HTMLCanvasElement | null) {
        self.cigarClickMapCanvas = ref
      },
      setMouseoverCanvasRef(ref: HTMLCanvasElement | null) {
        self.mouseoverRef = ref
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get adapterConfig() {
        return {
          // @ts-ignore
          name: self.parentTrack.configuration.adapter.type,
          assemblyNames: getConf(self, 'assemblyNames'),
          ...getConf(self.parentTrack, 'adapter'),
        }
      },
      /**
       * #getter
       * unused
       */
      get trackIds() {
        return getConf(self, 'trackIds') as string[]
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            if (self.mainCanvas && getContainingView(self).initialized) {
              drawRef(self, self.mainCanvas)
            }
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
              const view = getContainingView(self) as LinearSyntenyViewModel
              return {
                bpPerPx: view.views.map(v => v.bpPerPx),
                displayedRegions: view.views.map(v => v.displayedRegions),
                features: self.features,
                initialized: view.initialized,
              }
            },
            ({ initialized }) => {
              if (!initialized) {
                return
              }
              const { assemblyManager } = getSession(self)
              const parentView = getContainingView(
                self,
              ) as LinearSyntenyViewModel
              const viewSnaps = parentView.views.map(view => ({
                // @ts-ignore
                ...getSnapshot(view),
                width: view.width,
                staticBlocks: view.staticBlocks,
                interRegionPaddingWidth: view.interRegionPaddingWidth,
                minimumBlockWidth: view.minimumBlockWidth,
              }))

              const map = {} as FeatMap

              const feats = self.features || []

              for (let i = 0; i < feats.length; i++) {
                const f = feats[i]
                const mate = f.get('mate')
                let f1s = f.get('start')
                let f1e = f.get('end')
                const f2s = mate.start
                const f2e = mate.end

                if (f.get('strand') === -1) {
                  ;[f1e, f1s] = [f1s, f1e]
                }
                const a1 = assemblyManager?.get(f.get('assemblyName'))
                const a2 = assemblyManager?.get(mate.assemblyName)
                const r1 = f.get('refName')
                const r2 = mate.refName
                const ref1 = a1?.getCanonicalRefName(r1) || r1
                const ref2 = a2?.getCanonicalRefName(r2) || r2
                const v1 = viewSnaps[0]
                const v2 = viewSnaps[1]
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
                map[f.id()] = { p11, p12, p21, p22 }
              }

              self.setFeatPositions(map)
            },
            { fireImmediately: true },
          ),
        )
      },
    }))
}

const colorMap = {
  I: '#ff03',
  N: '#0a03',
  D: '#00f3',
  X: 'brown',
  M: '#ff000008',
  '=': '#f003',
}

function drawRef(model: LinearSyntenyDisplayModel, ref: HTMLCanvasElement) {
  const highResolutionScaling = 1
  const ctx1 = ref.getContext('2d')

  const view = getContainingView(model) as LinearSyntenyViewModel
  const height = view.middleComparativeHeight
  const width = view.width

  // const ctx3 = cigarClickMapRef.current.getContext('2d')

  if (!ctx1) {
    return
  }

  // ctx3.imageSmoothingEnabled = false

  ctx1.resetTransform()
  ctx1.scale(highResolutionScaling, highResolutionScaling)
  ctx1.clearRect(0, 0, width, height)
  ctx1.beginPath()
  const featPos = Object.values(model.featPositions)
  const offsets = view.views.map(v => v.offsetPx)

  //const unitMultiplier = Math.floor(MAX_COLOR_RANGE / featPos.length)

  // draw click map
  // requestIdleCallback(() => {
  //   if (!clickMapRef.current) {
  //     return
  //   }
  //   const ctx2 = clickMapRef.current.getContext('2d')
  //   if (!ctx2) {
  //     return
  //   }
  //   ctx2.imageSmoothingEnabled = false
  //   ctx2.clearRect(0, 0, width, height)
  //   for (let j = 0; j < matches.length; j++) {
  //     const m = matches[j]
  //     const idx = j * unitMultiplier + 1
  //     ctx2.fillStyle = makeColor(idx)

  //     // too many click map false positives with colored stroked lines
  //     drawMatchSimple({
  //       cb: ctx => ctx.fill(),
  //       match: m,
  //       ctx: ctx2,
  //       drawCurves,
  //       offsets,
  //       hideTiny,
  //       height,
  //       viewSnaps,
  //       showIntraviewLinks,
  //     })
  //   }
  // })

  // this loop is optimized to draw thousands/millions of thin lines as a polyline,
  // the polyline calls ctx.stroke once is much more efficient than calling stroke()
  // many times
  for (let i = 0; i < featPos.length; i++) {
    const { p11, p12, p21, p22 } = featPos[i]
    ctx1.fillStyle = colorMap.M
    ctx1.strokeStyle = colorMap.M

    // we follow a path in the list of chunks, not from top to bottom, just
    // in series following x1,y1 -> x2,y2

    // disable rendering connections in a single level
    // if (!showIntraviewLinks && l1 === l2) {
    //   continue
    // }
    // const length1 = f1.end - f1.start
    // const length2 = f2.end - f2.start

    // if (length1 < v1.bpPerPx && length2 < v2.bpPerPx) {
    //   if (hideTiny) {
    //     continue
    //   }

    const x11 = p11.offsetPx - offsets[0]
    const x21 = p21.offsetPx - offsets[1]

    const y1 = 0
    const y2 = height

    const mid = (y2 - y1) / 2

    // drawing a line if the results are thin results in much less
    // pixellation than filling in a thin polygon
    if (x21 < width + 800 && x21 > -800) {
      ctx1.moveTo(x11, y1)

      if (view.drawCurves) {
        ctx1.bezierCurveTo(x11, mid, x21, mid, x21, y2)
      } else {
        ctx1.lineTo(x21, y2)
      }
    }
  }
  ctx1.stroke()

  // this loop only draws small lines as a polyline, the polyline calls
  // ctx.stroke once is much more efficient than calling stroke() many times
  // for (let j = 0; j < matches.length; j++) {
  //   const m = matches[j]
  //   ctx1.fillStyle = colorMap.M
  //   ctx1.strokeStyle = colorMap.M

  //   // we follow a path in the list of chunks, not from top to bottom, just
  //   // in series following x1,y1 -> x2,y2
  //   for (let i = 0; i < m.length - 1; i += 1) {
  //     const { layout: c1, feature: f1, level: l1, refName: ref1 } = m[i]
  //     const { layout: c2, feature: f2, level: l2, refName: ref2 } = m[i + 1]
  //     const v1 = viewSnaps[l1]
  //     const v2 = viewSnaps[l2]

  //     if (!c1 || !c2) {
  //       console.warn('received null layout for a overlay feature')
  //       return
  //     }

  //     // disable rendering connections in a single level
  //     if (!showIntraviewLinks && l1 === l2) {
  //       continue
  //     }
  //     const length1 = f1.end - f1.start
  //     const length2 = f2.end - f2.start

  //     if ((length1 < v1.bpPerPx || length2 < v2.bpPerPx) && hideTiny) {
  //       continue
  //     }

  //     const p11 = bpToPx({ self: v1, refName: ref1, coord: c1[LEFT] })
  //     const p12 = bpToPx({ self: v1, refName: ref1, coord: c1[RIGHT] })
  //     const p21 = bpToPx({ self: v2, refName: ref2, coord: c2[LEFT] })
  //     const p22 = bpToPx({ self: v2, refName: ref2, coord: c2[RIGHT] })
  //     if (
  //       p11 === undefined ||
  //       p12 === undefined ||
  //       p21 === undefined ||
  //       p22 === undefined
  //     ) {
  //       continue
  //     }

  //     const x11 = p11.offsetPx - offsets[l1]
  //     const x12 = p12.offsetPx - offsets[l1]
  //     const x21 = p21.offsetPx - offsets[l2]
  //     const x22 = p22.offsetPx - offsets[l2]
  //     const minX = Math.min(x21, x22)
  //     const maxX = Math.max(x21, x22)

  //     const y1 = interstitialYPos(l1 < l2, height)
  //     const y2 = interstitialYPos(l2 < l1, height)

  //     const mid = (y2 - y1) / 2

  //     if (
  //       !(length1 < v1.bpPerPx || length2 < v2.bpPerPx) &&
  //       doesIntersect2(minX, maxX, -1600, view.width + 1600)
  //     ) {
  //       const s1 = f1.strand
  //       const k1 = s1 === -1 ? x12 : x11
  //       const k2 = s1 === -1 ? x11 : x12

  //       // rev1/rev2 flip the direction of the CIGAR drawing in horizontally flipped
  //       // modes. somewhat heuristically determined, but tested for
  //       const rev1 = k1 < k2 ? 1 : -1
  //       const rev2 = (x21 < x22 ? 1 : -1) * s1

  //       // cx1/cx2 are the current x positions on top and bottom rows
  //       let cx1 = k1
  //       let cx2 = s1 === -1 ? x22 : x21

  //       const cigar = parsedCIGARs.get(f1.uniqueId)
  //       if (cigar?.length && drawCIGAR) {
  //         // continuingFlag skips drawing commands on very small CIGAR features
  //         let continuingFlag = false

  //         // px1/px2 are the previous x positions on the top and bottom rows
  //         let px1 = 0
  //         let px2 = 0
  //         const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
  //         for (let j = 0; j < cigar.length; j += 2) {
  //           const idx = j * unitMultiplier2 + 1
  //           ctx3.fillStyle = makeColor(idx)

  //           const len = +cigar[j]
  //           const op = cigar[j + 1] as keyof typeof colorMap

  //           if (!continuingFlag) {
  //             px1 = cx1
  //             px2 = cx2
  //           }

  //           const d1 = len / viewSnaps[0].bpPerPx
  //           const d2 = len / viewSnaps[1].bpPerPx

  //           if (op === 'M' || op === '=' || op === 'X') {
  //             cx1 += d1 * rev1
  //             cx2 += d2 * rev2
  //           } else if (op === 'D' || op === 'N') {
  //             cx1 += d1 * rev1
  //           } else if (op === 'I') {
  //             cx2 += d2 * rev2
  //           }

  //           // check that we are even drawing in view here, e.g. that all
  //           // points are not all less than 0 or greater than width
  //           if (
  //             !(
  //               Math.max(px1, px2, cx1, cx2) < 0 ||
  //               Math.min(px1, px2, cx1, cx2) > width
  //             )
  //           ) {
  //             // if it is a small feature and not the last element of the
  //             // CIGAR (which could skip rendering it entire if we did turn
  //             // it on), then turn on continuing flag
  //             const isNotLast = j < cigar.length - 2
  //             if (
  //               Math.abs(cx1 - px1) < 1 &&
  //               Math.abs(cx2 - px2) < 1 &&
  //               isNotLast
  //             ) {
  //               continuingFlag = true
  //             } else {
  //               continuingFlag = false

  //               // allow rendering the dominant color when using continuing
  //               // flag if the last element of continuing was a large
  //               // feature, else just use match
  //               ctx1.fillStyle =
  //                 colorMap[(continuingFlag && d1 > 1) || d2 > 1 ? op : 'M']

  //               draw(ctx1, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
  //               draw(ctx3, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
  //             }
  //           }
  //         }
  //       } else {
  //         draw(ctx1, x11, x12, y1, x22, x21, y2, mid, drawCurves)
  //       }
  //     }
  //   }
  // }
}

export type LinearSyntenyDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearSyntenyDisplayModel = Instance<LinearSyntenyDisplayStateModel>

export default stateModelFactory
