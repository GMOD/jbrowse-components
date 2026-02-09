import { useCallback, useEffect, useRef, useState } from 'react'

import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { WebGLVariantRenderer } from './WebGLVariantRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import LoadingOverlay from '../../shared/components/LoadingOverlay.tsx'

import type { VariantCellData } from './computeVariantCells.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface VariantDisplayModel {
  webglCellData: VariantCellData | undefined
  availableHeight: number
  rowHeight: number
  scrollTop: number
  sources: { name: string; baseName?: string }[] | undefined
  featuresVolatile: { id(): string }[] | undefined
  referenceDrawingMode: string
  regionTooLarge: boolean
  regionTooLargeReason: string
  featuresReady: boolean
  statusMessage?: string
  visibleRegions: {
    refName: string
    regionNumber: number
    start: number
    end: number
    assemblyName: string
    screenStartPx: number
    screenEndPx: number
  }[]
  setFeatureDensityStatsLimit: (s?: unknown) => void
  setHoveredGenotype: (tooltip: Record<string, string> | undefined) => void
  selectFeature: (feature: { id(): string }) => void
}

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

const WebGLVariantComponent = observer(function WebGLVariantComponent({
  model,
}: {
  model: VariantDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLVariantRenderer | null>(null)
  const rafRef = useRef<number | undefined>(undefined)
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

    const regions = model.visibleRegions
    if (regions.length === 0) {
      return
    }

    const width = Math.round(view.dynamicBlocks.totalWidthPx)
    const height = model.availableHeight

    const blocks = regions.map(r => ({
      regionNumber: r.regionNumber,
      domainX: [r.start, r.end] as [number, number],
      screenStartPx: r.screenStartPx,
      screenEndPx: r.screenEndPx,
    }))

    rafRef.current = requestAnimationFrame(() => {
      renderer.renderBlocks(blocks, {
        canvasWidth: width,
        canvasHeight: height,
        rowHeight: model.rowHeight,
        scrollTop: model.scrollTop,
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
    model.visibleRegions,
    view,
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

      const regions = model.visibleRegions
      // Find which region block the mouse is in
      const region = regions.find(
        r => mouseX >= r.screenStartPx && mouseX < r.screenEndPx,
      )
      if (!region) {
        return undefined
      }

      const blockWidth = region.screenEndPx - region.screenStartPx
      const domainExtent = region.end - region.start
      const bpPerPx = domainExtent / blockWidth
      const bpPadding = MIN_HIT_TARGET_PX * bpPerPx

      const genomicPos =
        region.start +
        ((mouseX - region.screenStartPx) / blockWidth) * domainExtent
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
