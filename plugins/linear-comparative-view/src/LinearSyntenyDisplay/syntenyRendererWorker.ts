import { colord } from 'colord'

export const MAX_COLOR_RANGE = 255 * 255 * 255

function checkStopToken(stopToken: string | undefined) {
  if (stopToken !== undefined) {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', stopToken, false)
    try {
      xhr.send(null)
    } catch {
      throw new Error('aborted')
    }
  }
}

const category10 = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
]

function doesIntersect2(
  left1: number,
  right1: number,
  left2: number,
  right2: number,
) {
  return right1 > left2 && left1 < right2
}

interface Pos {
  offsetPx: number
}

export interface SerializedFeatPos {
  p11: Pos
  p12: Pos
  p21: Pos
  p22: Pos
  id: string
  strand: number
  refName: string
  name: string
  start: number
  end: number
  cigar: string[]
}

export interface UpdateFeaturesMessage {
  type: 'updateFeatures'
  featPositions: SerializedFeatPos[]
}

export interface DrawSyntenyMessage {
  type: 'draw'
  width: number
  height: number
  level: number
  offsets: number[]
  bpPerPxs: number[]
  drawCurves: boolean
  drawCIGAR: boolean
  drawCIGARMatchesOnly: boolean
  drawLocationMarkers: boolean
  alpha: number
  minAlignmentLength: number
  colorBy: string
  stopToken?: string
}

export type WorkerMessage = DrawSyntenyMessage | UpdateFeaturesMessage

interface DrawParams extends Omit<DrawSyntenyMessage, 'type'> {
  featPositions: SerializedFeatPos[]
}

export interface DrawResultMessage {
  type: 'done'
  mainBitmap: ImageBitmap
  clickMapBitmap: ImageBitmap
  cigarClickMapBitmap: ImageBitmap
}

let cachedFeatPositions: SerializedFeatPos[] = []
let pendingDrawMessage: DrawSyntenyMessage | null = null
let rafId: number | null = null

function makeColor(idx: number) {
  const r = Math.floor(idx / (255 * 255)) % 255
  const g = Math.floor(idx / 255) % 255
  const b = idx % 255
  return `rgb(${r},${g},${b})`
}

function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

function getQueryColor(queryName: string) {
  const hash = hashString(queryName)
  return category10[hash % category10.length]!
}

const defaultCigarColors = {
  I: '#ff03',
  N: '#0a03',
  D: '#00f3',
  X: 'brown',
  M: '#f003',
  '=': '#f003',
}

const strandCigarColors = {
  I: '#ff03',
  N: '#a020f0',
  D: '#a020f0',
  X: 'brown',
  M: '#f003',
  '=': '#f003',
}

const colorSchemes = {
  default: { cigarColors: defaultCigarColors },
  strand: {
    posColor: 'red',
    negColor: 'blue',
    cigarColors: strandCigarColors,
  },
  query: { cigarColors: defaultCigarColors },
}

type ColorScheme = keyof typeof colorSchemes

function applyAlpha(color: string, alpha: number) {
  if (alpha === 1) {
    return color
  }
  return colord(color).alpha(alpha).toHex()
}

const lineLimit = 3
const oobLimit = 1600

function drawBox(
  ctx: OffscreenCanvasRenderingContext2D,
  x1: number,
  x2: number,
  y1: number,
  x3: number,
  x4: number,
  y2: number,
) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y1)
  ctx.lineTo(x3, y2)
  ctx.lineTo(x4, y2)
  ctx.closePath()
}

function drawBezierBox(
  ctx: OffscreenCanvasRenderingContext2D,
  x1: number,
  x2: number,
  y1: number,
  x3: number,
  x4: number,
  y2: number,
  mid: number,
) {
  const len1 = Math.abs(x1 - x2)
  const len2 = Math.abs(x1 - x2)
  if (len1 < 5 && len2 < 5 && x2 < x1 && Math.abs(x1 - x3) > 100) {
    const tmp = x1
    x1 = x2
    x2 = tmp
  }
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y1)
  ctx.bezierCurveTo(x2, mid, x3, mid, x3, y2)
  ctx.lineTo(x4, y2)
  ctx.bezierCurveTo(x4, mid, x1, mid, x1, y1)
  ctx.closePath()
}

function draw(
  ctx: OffscreenCanvasRenderingContext2D,
  x1: number,
  x2: number,
  y1: number,
  x3: number,
  x4: number,
  y2: number,
  mid: number,
  drawCurves?: boolean,
) {
  if (drawCurves) {
    drawBezierBox(ctx, x1, x2, y1, x3, x4, y2, mid)
  } else {
    drawBox(ctx, x1, x2, y1, x3, x4, y2)
  }
}

function drawLocationMarkers(
  ctx: OffscreenCanvasRenderingContext2D,
  x1: number,
  x2: number,
  y1: number,
  x3: number,
  x4: number,
  y2: number,
  mid: number,
  bpPerPx1: number,
  bpPerPx2: number,
  drawCurves?: boolean,
) {
  const width1 = Math.abs(x2 - x1)
  const width2 = Math.abs(x4 - x3)
  const averageWidth = (width1 + width2) / 2

  if (averageWidth < 30) {
    return
  }

  const targetPixelSpacing = 20
  const numMarkers = Math.max(
    2,
    Math.floor(averageWidth / targetPixelSpacing) + 1,
  )

  const prevStrokeStyle = ctx.strokeStyle
  const prevLineWidth = ctx.lineWidth

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.lineWidth = 0.5

  ctx.beginPath()
  if (drawCurves) {
    for (let step = 0; step < numMarkers; step++) {
      const t = step / numMarkers
      const topX = x1 + (x2 - x1) * t
      const bottomX = x4 + (x3 - x4) * t
      ctx.moveTo(topX, y1)
      ctx.bezierCurveTo(topX, mid, bottomX, mid, bottomX, y2)
    }
  } else {
    for (let step = 0; step < numMarkers; step++) {
      const t = step / numMarkers
      const topX = x1 + (x2 - x1) * t
      const bottomX = x4 + (x3 - x4) * t
      ctx.moveTo(topX, y1)
      ctx.lineTo(bottomX, y2)
    }
  }
  ctx.stroke()

  ctx.strokeStyle = prevStrokeStyle
  ctx.lineWidth = prevLineWidth
}

function drawMatchSimple({
  feature,
  ctx,
  offsets,
  level,
  cb,
  height,
  drawCurves,
  oobLimit,
  viewWidth,
  hideTiny,
}: {
  feature: SerializedFeatPos
  ctx: OffscreenCanvasRenderingContext2D
  offsets: number[]
  level: number
  oobLimit: number
  viewWidth: number
  cb: (ctx: OffscreenCanvasRenderingContext2D) => void
  height: number
  drawCurves?: boolean
  hideTiny?: boolean
}) {
  const { p11, p12, p21, p22 } = feature

  const x11 = p11.offsetPx - offsets[level]!
  const x12 = p12.offsetPx - offsets[level]!
  const x21 = p21.offsetPx - offsets[level + 1]!
  const x22 = p22.offsetPx - offsets[level + 1]!

  const l1 = Math.abs(x12 - x11)
  const l2 = Math.abs(x22 - x21)
  const y1 = 0
  const y2 = height
  const mid = (y2 - y1) / 2
  const minX = Math.min(x21, x22)
  const maxX = Math.max(x21, x22)

  if (!doesIntersect2(minX, maxX, -oobLimit, viewWidth + oobLimit)) {
    return
  }

  if (l1 <= 1 && l2 <= 1) {
    if (!hideTiny) {
      ctx.beginPath()
      ctx.moveTo(x11, y1)
      if (drawCurves) {
        ctx.bezierCurveTo(x11, mid, x21, mid, x21, y2)
      } else {
        ctx.lineTo(x21, y2)
      }
      ctx.stroke()
    }
  } else {
    draw(ctx, x11, x12, y1, x22, x21, y2, mid, drawCurves)
    cb(ctx)
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function drawCigarClickMapImpl(
  msg: DrawParams,
  ctx: OffscreenCanvasRenderingContext2D,
) {
  const {
    featPositions,
    width,
    height,
    level,
    offsets,
    bpPerPxs,
    drawCurves,
    drawCIGAR,
    drawCIGARMatchesOnly,
  } = msg

  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, width, height)

  const bpPerPxInv0 = 1 / bpPerPxs[level]!
  const bpPerPxInv1 = 1 / bpPerPxs[level + 1]!

  for (let i = 0, l = featPositions.length; i < l; i++) {
    // // Check stop token every 100 features
    // if (i % 100 === 0) {
    //   checkStopToken(msg.stopToken)
    // }

    const { p11, p12, p21, p22, strand, cigar } = featPositions[i]!
    const x11 = p11.offsetPx - offsets[level]!
    const x12 = p12.offsetPx - offsets[level]!
    const x21 = p21.offsetPx - offsets[level + 1]!
    const x22 = p22.offsetPx - offsets[level + 1]!
    const l1 = Math.abs(x12 - x11)
    const l2 = Math.abs(x22 - x21)
    const minX = Math.min(x21, x22)
    const maxX = Math.max(x21, x22)
    const y1 = 0
    const y2 = height
    const mid = (y2 - y1) / 2

    if (
      !(l1 <= lineLimit && l2 <= lineLimit) &&
      doesIntersect2(minX, maxX, -oobLimit, width + oobLimit)
    ) {
      const s1 = strand
      const k1 = s1 === -1 ? x12 : x11
      const k2 = s1 === -1 ? x11 : x12

      const rev1 = k1 < k2 ? 1 : -1
      const rev2 = (x21 < x22 ? 1 : -1) * s1

      let cx1 = k1
      let cx2 = s1 === -1 ? x22 : x21
      if (cigar.length && drawCIGAR) {
        let continuingFlag = false
        let px1 = 0
        let px2 = 0
        const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)

        for (let j = 0; j < cigar.length; j += 2) {
          const len = +cigar[j]!
          const op = cigar[j + 1] as keyof typeof defaultCigarColors

          if (!continuingFlag) {
            px1 = cx1
            px2 = cx2
          }

          const d1 = len * bpPerPxInv0
          const d2 = len * bpPerPxInv1

          if (op === 'M' || op === '=' || op === 'X') {
            cx1 += d1 * rev1
            cx2 += d2 * rev2
          } else if (op === 'D' || op === 'N') {
            cx1 += d1 * rev1
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          } else if (op === 'I') {
            cx2 += d2 * rev2
          }

          if (
            !(
              Math.max(px1, px2, cx1, cx2) < 0 ||
              Math.min(px1, px2, cx1, cx2) > width
            )
          ) {
            const isNotLast = j < cigar.length - 2
            if (
              Math.abs(cx1 - px1) <= 1 &&
              Math.abs(cx2 - px2) <= 1 &&
              isNotLast
            ) {
              continuingFlag = true
            } else {
              continuingFlag = false
              const shouldDraw =
                !drawCIGARMatchesOnly ||
                ((op === 'M' || op === '=' || op === 'X') &&
                  Math.abs(cx1 - px1) > 1 &&
                  Math.abs(cx2 - px2) > 1)

              if (shouldDraw) {
                const idx = j * unitMultiplier2 + 1
                ctx.fillStyle = makeColor(idx)
                draw(ctx, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
                ctx.fill()
              }
            }
          }
        }
      }
    }
  }
}

function drawRefImpl(
  msg: DrawParams,
  mainCtx: OffscreenCanvasRenderingContext2D,
  clickMapCtx: OffscreenCanvasRenderingContext2D,
) {
  const {
    featPositions,
    width,
    height,
    level,
    offsets,
    bpPerPxs,
    drawCurves,
    drawCIGAR,
    drawCIGARMatchesOnly,
    drawLocationMarkers: drawLocationMarkersEnabled,
    alpha,
    minAlignmentLength,
    colorBy,
  } = msg

  const queryTotalLengths = new Map<string, number>()
  if (minAlignmentLength > 0) {
    for (const feat of featPositions) {
      const queryName = feat.name || feat.id
      const alignmentLength = Math.abs(feat.end - feat.start)
      const currentTotal = queryTotalLengths.get(queryName) || 0
      queryTotalLengths.set(queryName, currentTotal + alignmentLength)
    }
  }

  const schemeConfig =
    (colorBy in colorSchemes
      ? colorSchemes[colorBy as ColorScheme]
      : undefined) ?? colorSchemes.default
  const activeColorMap = schemeConfig.cigarColors

  const posColor = colorBy === 'strand' ? colorSchemes.strand.posColor : 'red'
  const negColor = colorBy === 'strand' ? colorSchemes.strand.negColor : 'blue'

  const colorMapWithAlpha = {
    I: applyAlpha(activeColorMap.I, alpha),
    N: applyAlpha(activeColorMap.N, alpha),
    D: applyAlpha(activeColorMap.D, alpha),
    X: applyAlpha(activeColorMap.X, alpha),
    M: applyAlpha(activeColorMap.M, alpha),
    '=': applyAlpha(activeColorMap['='], alpha),
  }

  const posColorWithAlpha = applyAlpha(posColor, alpha)
  const negColorWithAlpha = applyAlpha(negColor, alpha)

  const queryColorCache = new Map<string, string>()
  const getQueryColorWithAlpha = (queryName: string) => {
    if (!queryColorCache.has(queryName)) {
      const color = getQueryColor(queryName)
      queryColorCache.set(queryName, applyAlpha(color, alpha))
    }
    return queryColorCache.get(queryName)!
  }

  mainCtx.clearRect(0, 0, width, height)
  mainCtx.beginPath()

  const offsetsL0 = offsets[level]!
  const offsetsL1 = offsets[level + 1]!
  const unitMultiplier = Math.floor(MAX_COLOR_RANGE / featPositions.length)
  const y1 = 0
  const y2 = height
  const mid = (y2 - y1) / 2

  const useStrandColorThin = colorBy === 'strand'
  const useQueryColorThin = colorBy === 'query'

  mainCtx.fillStyle = colorMapWithAlpha.M
  mainCtx.strokeStyle = colorMapWithAlpha.M

  const thinLinesByColor = new Map<
    string,
    { x11: number; x21: number; y1: number; y2: number; mid: number }[]
  >()

  for (let i = 0, l = featPositions.length; i < l; i++) {
    // // Check stop token every 100 features
    // if (i % 100 === 0) {
    //   checkStopToken(msg.stopToken)
    // }

    const feat = featPositions[i]!
    if (minAlignmentLength > 0) {
      const queryName = feat.name || feat.id
      const totalLength = queryTotalLengths.get(queryName) || 0
      if (totalLength < minAlignmentLength) {
        continue
      }
    }

    const { p11, p12, p21, p22, strand, refName } = feat
    const x11 = p11.offsetPx - offsetsL0
    const x12 = p12.offsetPx - offsetsL0
    const x21 = p21.offsetPx - offsetsL1
    const x22 = p22.offsetPx - offsetsL1
    const l1 = Math.abs(x12 - x11)
    const l2 = Math.abs(x22 - x21)

    if (
      l1 <= lineLimit &&
      l2 <= lineLimit &&
      x21 < width + oobLimit &&
      x21 > -oobLimit
    ) {
      let colorKey = 'default'
      if (useStrandColorThin) {
        colorKey = strand === -1 ? 'neg' : 'pos'
      } else if (useQueryColorThin) {
        colorKey = refName
      }

      if (!thinLinesByColor.has(colorKey)) {
        thinLinesByColor.set(colorKey, [])
      }
      thinLinesByColor.get(colorKey)!.push({ x11, x21, y1, y2, mid })
    }
  }

  for (const [colorKey, lines] of thinLinesByColor) {
    if (colorKey === 'pos') {
      mainCtx.strokeStyle = posColorWithAlpha
    } else if (colorKey === 'neg') {
      mainCtx.strokeStyle = negColorWithAlpha
    } else if (colorKey !== 'default') {
      mainCtx.strokeStyle = getQueryColorWithAlpha(colorKey)
    } else {
      mainCtx.strokeStyle = colorMapWithAlpha.M
    }

    mainCtx.beginPath()
    if (drawCurves) {
      for (const { x11, x21, y1, y2, mid } of lines) {
        mainCtx.moveTo(x11, y1)
        mainCtx.bezierCurveTo(x11, mid, x21, mid, x21, y2)
      }
    } else {
      for (const { x11, x21, y1, y2 } of lines) {
        mainCtx.moveTo(x11, y1)
        mainCtx.lineTo(x21, y2)
      }
    }
    mainCtx.stroke()
  }

  const bpPerPx0 = bpPerPxs[level]!
  const bpPerPx1 = bpPerPxs[level + 1]!
  const bpPerPxInv0 = 1 / bpPerPx0
  const bpPerPxInv1 = 1 / bpPerPx1

  const useStrandColor = colorBy === 'strand'
  const useQueryColor = colorBy === 'query'

  mainCtx.fillStyle = colorMapWithAlpha.M
  mainCtx.strokeStyle = colorMapWithAlpha.M

  for (let i = 0, l = featPositions.length; i < l; i++) {
    // // Check stop token every 100 features
    // if (i % 100 === 0) {
    //   checkStopToken(msg.stopToken)
    // }

    const feat = featPositions[i]!
    const { strand, refName, cigar, p11, p12, p21, p22 } = feat

    if (minAlignmentLength > 0) {
      const queryName = feat.name || feat.id
      const totalLength = queryTotalLengths.get(queryName) || 0
      if (totalLength < minAlignmentLength) {
        continue
      }
    }

    const x11 = p11.offsetPx - offsetsL0
    const x12 = p12.offsetPx - offsetsL0
    const x21 = p21.offsetPx - offsetsL1
    const x22 = p22.offsetPx - offsetsL1
    const l1 = Math.abs(x12 - x11)
    const l2 = Math.abs(x22 - x21)
    const minX = Math.min(x21, x22)
    const maxX = Math.max(x21, x22)

    if (
      !(l1 <= lineLimit && l2 <= lineLimit) &&
      doesIntersect2(minX, maxX, -oobLimit, width + oobLimit)
    ) {
      const s1 = strand
      const k1 = s1 === -1 ? x12 : x11
      const k2 = s1 === -1 ? x11 : x12

      const rev1 = k1 < k2 ? 1 : -1
      const rev2 = (x21 < x22 ? 1 : -1) * s1

      let cx1 = k1
      let cx2 = s1 === -1 ? x22 : x21

      if (cigar.length && drawCIGAR) {
        let continuingFlag = false
        let px1 = 0
        let px2 = 0

        for (let j = 0; j < cigar.length; j += 2) {
          const len = +cigar[j]!
          const op = cigar[j + 1] as keyof typeof defaultCigarColors

          if (!continuingFlag) {
            px1 = cx1
            px2 = cx2
          }

          const d1 = len * bpPerPxInv0
          const d2 = len * bpPerPxInv1

          if (op === 'M' || op === '=' || op === 'X') {
            cx1 += d1 * rev1
            cx2 += d2 * rev2
          } else if (op === 'D' || op === 'N') {
            cx1 += d1 * rev1
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          } else if (op === 'I') {
            cx2 += d2 * rev2
          }

          if (
            !(
              Math.max(px1, px2, cx1, cx2) < 0 ||
              Math.min(px1, px2, cx1, cx2) > width
            )
          ) {
            const isNotLast = j < cigar.length - 2
            if (
              Math.abs(cx1 - px1) <= 1 &&
              Math.abs(cx2 - px2) <= 1 &&
              isNotLast
            ) {
              continuingFlag = true
            } else {
              const letter = (continuingFlag && d1 > 1) || d2 > 1 ? op : 'M'

              const isInsertionOrDeletion =
                letter === 'I' || letter === 'D' || letter === 'N'
              if (useStrandColor && !isInsertionOrDeletion) {
                mainCtx.fillStyle =
                  strand === -1 ? negColorWithAlpha : posColorWithAlpha
              } else if (useQueryColor && !isInsertionOrDeletion) {
                mainCtx.fillStyle = getQueryColorWithAlpha(refName)
              } else {
                mainCtx.fillStyle = colorMapWithAlpha[letter]
              }

              continuingFlag = false

              if (drawCIGARMatchesOnly) {
                if (letter === 'M') {
                  draw(mainCtx, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
                  mainCtx.fill()
                  if (drawLocationMarkersEnabled) {
                    drawLocationMarkers(
                      mainCtx,
                      px1,
                      cx1,
                      y1,
                      cx2,
                      px2,
                      y2,
                      mid,
                      bpPerPx0,
                      bpPerPx1,
                      drawCurves,
                    )
                  }
                }
              } else {
                draw(mainCtx, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
                mainCtx.fill()
                if (drawLocationMarkersEnabled) {
                  drawLocationMarkers(
                    mainCtx,
                    px1,
                    cx1,
                    y1,
                    cx2,
                    px2,
                    y2,
                    mid,
                    bpPerPx0,
                    bpPerPx1,
                    drawCurves,
                  )
                }
              }
            }
          }
        }
      } else {
        if (useStrandColor) {
          mainCtx.fillStyle =
            strand === -1 ? negColorWithAlpha : posColorWithAlpha
        } else if (useQueryColor) {
          mainCtx.fillStyle = getQueryColorWithAlpha(refName)
        }

        draw(mainCtx, x11, x12, y1, x22, x21, y2, mid, drawCurves)
        mainCtx.fill()

        if (useStrandColor || useQueryColor) {
          mainCtx.fillStyle = colorMapWithAlpha.M
        }
      }
    }
  }

  // Draw click map
  clickMapCtx.imageSmoothingEnabled = false
  clickMapCtx.clearRect(0, 0, width, height)

  for (let i = 0, l = featPositions.length; i < l; i++) {
    // Check stop token every 100 features
    if (i % 100 === 0) {
      checkStopToken(msg.stopToken)
    }

    const feature = featPositions[i]!

    if (minAlignmentLength > 0) {
      const queryName = feature.name || feature.id
      const totalLength = queryTotalLengths.get(queryName) || 0
      if (totalLength < minAlignmentLength) {
        continue
      }
    }

    const idx = i * unitMultiplier + 1
    clickMapCtx.fillStyle = makeColor(idx)

    drawMatchSimple({
      cb: ctx => {
        ctx.fill()
      },
      feature,
      ctx: clickMapCtx,
      drawCurves,
      level,
      offsets,
      oobLimit,
      viewWidth: width,
      hideTiny: true,
      height,
    })
  }
}

function performDraw() {
  rafId = null
  const msg = pendingDrawMessage
  pendingDrawMessage = null

  if (!msg || cachedFeatPositions.length === 0) {
    return
  }

  // Create offscreen canvases for drawing
  const mainCanvas = new OffscreenCanvas(msg.width, msg.height)
  const mainCtx = mainCanvas.getContext('2d')
  const clickMapCanvas = new OffscreenCanvas(msg.width, msg.height)
  const cigarClickMapCanvas = new OffscreenCanvas(msg.width, msg.height)
  const clickMapCtx = clickMapCanvas.getContext('2d')
  const cigarClickMapCtx = cigarClickMapCanvas.getContext('2d')

  if (!mainCtx || !clickMapCtx || !cigarClickMapCtx) {
    return
  }

  const drawParams: DrawParams = {
    ...msg,
    featPositions: cachedFeatPositions,
  }

  try {
    drawRefImpl(drawParams, mainCtx, clickMapCtx)

    // Transfer all bitmaps back to main thread
    const mainBitmap = mainCanvas.transferToImageBitmap()
    const clickMapBitmap = clickMapCanvas.transferToImageBitmap()
    const cigarClickMapBitmap = cigarClickMapCanvas.transferToImageBitmap()

    const result: DrawResultMessage = {
      type: 'done',
      mainBitmap,
      clickMapBitmap,
      cigarClickMapBitmap,
    }

    ;(self as DedicatedWorkerGlobalScope).postMessage(result, [
      mainBitmap,
      clickMapBitmap,
      cigarClickMapBitmap,
    ])
  } catch (e) {
    if (e instanceof Error && e.message === 'aborted') {
      return
    }
    throw e
  }
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data

  if (msg.type === 'updateFeatures') {
    cachedFeatPositions = msg.featPositions
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  } else if (msg.type === 'draw') {
    // Store the latest draw message and schedule a draw on the next animation frame
    // This coalesces multiple draw requests and syncs with the display refresh
    pendingDrawMessage = msg
    if (rafId === null) {
      rafId = requestAnimationFrame(performDraw)
    }
  }
}
