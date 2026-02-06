import { useEffect, useRef, useState } from 'react'

import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { WebGLVariantRenderer } from './WebGLVariantRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'

import type { VariantCellData } from './computeVariantCells.ts'
import type { MultiWebGLVariantDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

function binarySearchFeatures(
  featureList: VariantCellData['featureList'],
  genomicPos: number,
) {
  const results = []
  let lo = 0
  let hi = featureList.length - 1

  // find first feature that could overlap
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (featureList[mid]!.end <= genomicPos) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  for (let i = lo; i < featureList.length; i++) {
    const f = featureList[i]!
    if (f.start > genomicPos) {
      break
    }
    if (f.start <= genomicPos && f.end > genomicPos) {
      results.push(f)
    }
  }
  return results
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

    const blocks = view.dynamicBlocks.contentBlocks
    const first = blocks[0]
    if (!first) {
      return
    }

    const last = blocks[blocks.length - 1]
    let domainStart: number
    let domainEnd: number
    if (first.refName !== last?.refName) {
      domainStart = first.start
      domainEnd = first.end
    } else {
      const bpPerPx = view.bpPerPx
      const blockOffsetPx = first.offsetPx
      const deltaPx = view.offsetPx - blockOffsetPx
      domainStart = first.start + deltaPx * bpPerPx
      domainEnd = domainStart + view.width * bpPerPx
    }

    const width = Math.round(view.dynamicBlocks.totalWidthPx)
    const height = model.availableHeight

    rafRef.current = requestAnimationFrame(() => {
      renderer.render({
        domainX: [domainStart, domainEnd],
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
        }}
        width={width}
        height={height}
        onMouseMove={event => {
          const cellData = cellDataRef.current
          const sources = model.sources
          if (!cellData || !sources?.length) {
            return
          }
          const rect = event.currentTarget.getBoundingClientRect()
          const mouseX = event.clientX - rect.left
          const mouseY = event.clientY - rect.top

          const blocks = view.dynamicBlocks.contentBlocks
          const first = blocks[0]
          if (!first) {
            return
          }
          const last = blocks[blocks.length - 1]
          let domainStart: number
          let domainEnd: number
          if (first.refName !== last?.refName) {
            domainStart = first.start
            domainEnd = first.end
          } else {
            const bpPerPx = view.bpPerPx
            const blockOffsetPx = first.offsetPx
            const deltaPx = view.offsetPx - blockOffsetPx
            domainStart = first.start + deltaPx * bpPerPx
            domainEnd = domainStart + view.width * bpPerPx
          }

          const genomicPos =
            domainStart + (mouseX / width) * (domainEnd - domainStart)
          const rowIdx = Math.floor(
            (mouseY + model.scrollTop) / model.rowHeight,
          )
          const source = sources[rowIdx]
          if (!source) {
            model.setHoveredGenotype(undefined)
            return
          }

          const hits = binarySearchFeatures(cellData.featureList, genomicPos)
          if (hits.length > 0) {
            const hit = hits[0]!
            const info = cellData.featureGenotypeMap[hit.featureId]
            if (info) {
              const sampleName = source.baseName ?? source.name
              const genotype = info.genotypes[sampleName]
              if (genotype) {
                const alleles = makeSimpleAltString(genotype, info.ref, info.alt)
                model.setHoveredGenotype({
                  genotype,
                  alleles,
                  featureName: info.name,
                  description:
                    info.alt.length >= 3
                      ? 'multiple ALT alleles'
                      : info.description,
                  length: getBpDisplayStr(info.length),
                  name: source.name,
                })
              } else {
                model.setHoveredGenotype(undefined)
              }
            } else {
              model.setHoveredGenotype(undefined)
            }
          } else {
            model.setHoveredGenotype(undefined)
          }
        }}
        onMouseLeave={() => {
          model.setHoveredGenotype(undefined)
        }}
        onClick={event => {
          const cellData = cellDataRef.current
          const features = model.featuresVolatile
          if (!cellData || !features) {
            return
          }
          const rect = event.currentTarget.getBoundingClientRect()
          const mouseX = event.clientX - rect.left

          const blocks = view.dynamicBlocks.contentBlocks
          const first = blocks[0]
          if (!first) {
            return
          }
          const last = blocks[blocks.length - 1]
          let domainStart: number
          let domainEnd: number
          if (first.refName !== last?.refName) {
            domainStart = first.start
            domainEnd = first.end
          } else {
            const bpPerPx = view.bpPerPx
            const blockOffsetPx = first.offsetPx
            const deltaPx = view.offsetPx - blockOffsetPx
            domainStart = first.start + deltaPx * bpPerPx
            domainEnd = domainStart + view.width * bpPerPx
          }

          const genomicPos =
            domainStart + (mouseX / width) * (domainEnd - domainStart)
          const hits = binarySearchFeatures(cellData.featureList, genomicPos)
          if (hits.length > 0) {
            const hit = hits[0]!
            const feature = features.find(f => f.id() === hit.featureId)
            if (feature) {
              model.selectFeature(feature)
            }
          }
        }}
      />
    </div>
  )
})

export default WebGLVariantComponent
