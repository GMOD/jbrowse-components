import { useCallback, useEffect, useRef, useState } from 'react'

import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { WebGLVariantRenderer } from './WebGLVariantRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import LoadingOverlay from '../../shared/components/LoadingOverlay.tsx'

import type { VariantCellData } from './computeVariantCells.ts'
import type { MultiWebGLVariantDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

// minimum visual hit target in pixels — accounts for shapes like insertion
// triangles that are drawn wider than their genomic coordinates
const MIN_HIT_TARGET_PX = 4

function findSmallestOverlappingFeature(
  featureList: VariantCellData['featureList'],
  genomicPos: number,
  bpPadding: number,
) {
  const searchStart = genomicPos - bpPadding
  const searchEnd = genomicPos + bpPadding

  let lo = 0
  let hi = featureList.length - 1

  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (featureList[mid]!.end <= searchStart) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  let best: VariantCellData['featureList'][number] | undefined
  let bestLen = Infinity
  for (let i = lo; i < featureList.length; i++) {
    const f = featureList[i]!
    if (f.start > searchEnd) {
      break
    }
    if (f.start <= searchEnd && f.end > searchStart) {
      const len = f.end - f.start
      if (len < bestLen) {
        bestLen = len
        best = f
      }
    }
  }
  return best
}

function getDomain(view: LGV) {
  const blocks = view.dynamicBlocks.contentBlocks
  const first = blocks[0]
  if (!first) {
    return undefined
  }
  const last = blocks[blocks.length - 1]
  if (first.refName !== last?.refName) {
    return [first.start, first.end] as const
  }
  const bpPerPx = view.bpPerPx
  const blockOffsetPx = first.offsetPx
  const deltaPx = view.offsetPx - blockOffsetPx
  const domainStart = first.start + deltaPx * bpPerPx
  return [domainStart, domainStart + view.width * bpPerPx] as const
}

const WebGLVariantComponent = observer(function WebGLVariantComponent({
  model,
}: {
  model: MultiWebGLVariantDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLVariantRenderer | null>(null)
  const rafRef = useRef<number>()
  const cellDataRef = useRef<VariantCellData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const view = getContainingView(model) as LGV

  // Initialize WebGL renderer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    try {
      rendererRef.current = new WebGLVariantRenderer(canvas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'WebGL initialization failed')
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [])

  // Upload pre-computed cell data from worker when it arrives
  useEffect(() => {
    const renderer = rendererRef.current
    const cellData = model.webglCellData
    if (!renderer || !cellData) {
      cellDataRef.current = null
      return
    }
    cellDataRef.current = cellData
    renderer.uploadCellData(cellData)
  }, [model.webglCellData])

  // Render when view state changes
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !view.initialized) {
      return
    }

    const domain = getDomain(view)
    if (!domain) {
      return
    }

    const width = Math.round(view.dynamicBlocks.totalWidthPx)
    const height = model.availableHeight

    rafRef.current = requestAnimationFrame(() => {
      renderer.render({
        domainX: [domain[0], domain[1]],
        canvasWidth: width,
        canvasHeight: height,
        rowHeight: model.rowHeight,
        scrollTop: model.scrollTop,
        regionStart: cellDataRef.current?.regionStart ?? 0,
      })
    })

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [
    model,
    model.webglCellData,
    model.availableHeight,
    model.rowHeight,
    model.scrollTop,
    model.sources,
    view.initialized,
    view.bpPerPx,
    view.offsetPx,
    view.dynamicBlocks.totalWidthPx,
  ])

  const lastHoveredRef = useRef<string | undefined>(undefined)

  const getFeatureUnderMouse = useCallback(
    (eventClientX: number, eventClientY: number) => {
      const canvas = canvasRef.current
      const cellData = cellDataRef.current
      const sources = model.sources
      if (!canvas || !cellData || !sources?.length) {
        return undefined
      }
      const rect = canvas.getBoundingClientRect()
      const mouseX = eventClientX - rect.left
      const mouseY = eventClientY - rect.top
      const w = Math.round(view.dynamicBlocks.totalWidthPx)

      const domain = getDomain(view)
      if (!domain) {
        return undefined
      }

      const bpPerPx = (domain[1] - domain[0]) / w
      const bpPadding = MIN_HIT_TARGET_PX * bpPerPx

      const genomicPos = domain[0] + (mouseX / w) * (domain[1] - domain[0])
      const rowIdx = Math.floor((mouseY + model.scrollTop) / model.rowHeight)
      const source = sources[rowIdx]
      if (!source) {
        return undefined
      }

      const hit = findSmallestOverlappingFeature(
        cellData.featureList,
        genomicPos,
        bpPadding,
      )
      if (hit) {
        const info = cellData.featureGenotypeMap[hit.featureId]
        if (info) {
          const sampleName = source.baseName ?? source.name
          const genotype = info.genotypes[sampleName]
          if (genotype) {
            const alleles = makeSimpleAltString(genotype, info.ref, info.alt)
            return {
              genotype,
              alleles,
              featureName: info.name,
              description:
                info.alt.length >= 3
                  ? 'multiple ALT alleles'
                  : info.description,
              length: getBpDisplayStr(info.length),
              name: source.name,
              featureId: hit.featureId,
            }
          }
        }
      }
      return undefined
    },
    [model, view],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const result = getFeatureUnderMouse(e.clientX, e.clientY)
      const key = result
        ? `${result.name}:${result.genotype}:${result.featureId}`
        : undefined
      if (key !== lastHoveredRef.current) {
        lastHoveredRef.current = key
        if (result) {
          const { featureId, ...tooltip } = result
          model.setHoveredGenotype(tooltip)
        } else {
          model.setHoveredGenotype(undefined)
        }
      }
    },
    [getFeatureUnderMouse, model],
  )

  const handleMouseLeave = useCallback(() => {
    if (lastHoveredRef.current !== undefined) {
      lastHoveredRef.current = undefined
      model.setHoveredGenotype(undefined)
    }
  }, [model])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const cellData = cellDataRef.current
      const features = model.featuresVolatile
      if (!cellData || !features) {
        return
      }
      const result = getFeatureUnderMouse(e.clientX, e.clientY)
      if (result) {
        const feature = features.find(f => f.id() === result.featureId)
        if (feature) {
          model.selectFeature(feature)
        }
      }
    },
    [getFeatureUnderMouse, model],
  )

  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const height = model.availableHeight

  if (error) {
    return (
      <div style={{ width, height, color: 'red', padding: 10 }}>
        WebGL Error: {error}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        style={{
          width,
          height,
          position: 'absolute',
          left: 0,
          top: 0,
          backgroundColor:
            model.referenceDrawingMode === 'skip' ? '#ccc' : undefined,
        }}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      {!model.webglCellData || model.regionTooLarge ? (
        <LoadingOverlay model={model} />
      ) : null}
    </div>
  )
})

export default WebGLVariantComponent
