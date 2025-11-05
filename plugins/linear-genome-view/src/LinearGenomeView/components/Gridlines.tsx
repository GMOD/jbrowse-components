import { memo, useEffect, useMemo, useRef } from 'react'

import { useTheme } from '@mui/material'
import { reaction } from 'mobx'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import {
  ContentBlock as ContentBlockComponent,
  ElidedBlock as ElidedBlockComponent,
  InterRegionPaddingBlock as InterRegionPaddingBlockComponent,
} from '../../BaseLinearDisplay/components/Block'
import { makeTicks } from '../util'

import type { LinearGenomeViewModel } from '..'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  verticalGuidesZoomContainer: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: '100%',
    pointerEvents: 'none',
    contain: 'layout style paint',
  },
  verticalGuidesContainer: {
    position: 'absolute',
    height: '100%',
    pointerEvents: 'none',
    display: 'flex',
    contain: 'layout style',
  },
  tick: {
    position: 'absolute',
    height: '100%',
    width: 1,
    willChange: 'transform',
  },
  majorTick: {
    background: theme.palette.action.disabled,
  },
  minorTick: {
    background: theme.palette.divider,
  },
}))

const RenderedBlockLines = memo(
  function RenderedBlockLines({
    block,
    bpPerPx,
    majorColor,
    minorColor,
  }: {
    block: ContentBlock
    bpPerPx: number
    majorColor: string
    minorColor: string
  }) {
    const svgRef = useRef<SVGSVGElement>(null)
    const lastRenderedKey = useRef<string>('')

    // Update SVG lines directly without React, with manual caching
    useEffect(() => {
      const svg = svgRef.current
      if (!svg) {
        return
      }

      // Create a cache key based on actual values
      const cacheKey = `${block.key}-${block.start}-${block.end}-${block.reversed}-${bpPerPx}-${majorColor}-${minorColor}`

      // Skip if nothing actually changed
      if (lastRenderedKey.current === cacheKey) {
        return
      }

      lastRenderedKey.current = cacheKey

      const ticks = makeTicks(block.start, block.end, bpPerPx)

      // Clear existing lines
      svg.innerHTML = ''

      // Create lines directly in SVG
      const fragment = document.createDocumentFragment()
      for (const { type, base } of ticks) {
        const x =
          (block.reversed ? block.end - base : base - block.start) / bpPerPx
        const line = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'line',
        )
        line.setAttribute('x1', String(x))
        line.setAttribute('y1', '0')
        line.setAttribute('x2', String(x))
        line.setAttribute('y2', '100%')
        line.setAttribute(
          'stroke',
          type === 'major' || type === 'labeledMajor' ? majorColor : minorColor,
        )
        line.setAttribute('stroke-width', '1')
        fragment.append(line)
      }
      svg.append(fragment)
    }) // No dependencies - runs every render but has manual cache check

    return (
      <ContentBlockComponent block={block}>
        <svg
          ref={svgRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
      </ContentBlockComponent>
    )
  },
  (prevProps, nextProps) => {
    // Only re-render if block key or bpPerPx actually changes
    return (
      prevProps.block.key === nextProps.block.key &&
      prevProps.bpPerPx === nextProps.bpPerPx &&
      prevProps.majorColor === nextProps.majorColor &&
      prevProps.minorColor === nextProps.minorColor
    )
  },
)

const RenderedVerticalGuides = observer(function ({ model }: { model: LGV }) {
  const { coarseStaticBlocks, bpPerPx } = model
  const theme = useTheme()

  // Memoize theme colors to prevent unnecessary recalculations
  const { majorColor, minorColor } = useMemo(
    () => ({
      majorColor: theme.palette.action.disabled,
      minorColor: theme.palette.divider,
    }),
    [theme.palette.action.disabled, theme.palette.divider],
  )

  // Create stable key to prevent unnecessary re-renders when blocks haven't changed
  const blocksKey = useMemo(
    () =>
      coarseStaticBlocks
        ? coarseStaticBlocks.map(b => `${b.key}-${b.widthPx}`).join(',')
        : '',
    [coarseStaticBlocks],
  )

  // Memoize block elements to prevent recreation on every render
  // Note: blocksKey changes only when actual blocks change, not when coarseStaticBlocks reference changes
  const blockElements = useMemo(
    () =>
      coarseStaticBlocks ? (
        <>
          {coarseStaticBlocks.map((block, index) => {
            const k = `${block.key}-${index}`
            if (block.type === 'ContentBlock') {
              return (
                <RenderedBlockLines
                  key={k}
                  block={block}
                  bpPerPx={bpPerPx}
                  majorColor={majorColor}
                  minorColor={minorColor}
                />
              )
            } else if (block.type === 'ElidedBlock') {
              return <ElidedBlockComponent key={k} width={block.widthPx} />
            } else if (block.type === 'InterRegionPaddingBlock') {
              return (
                <InterRegionPaddingBlockComponent
                  key={k}
                  width={block.widthPx}
                  boundary={block.variant === 'boundary'}
                />
              )
            }
            return null
          })}
        </>
      ) : null,
    // Claude Code reasoning for the disable:
    //
    // The Pattern:
    //
    // const blocksKey = useMemo(() =>
    //   coarseStaticBlocks?.map(b => `${b.key}-${b.widthPx}`).join(','),
    //   [coarseStaticBlocks]
    // )
    //
    // const blockElements = useMemo(() => {
    //   // Use coarseStaticBlocks here
    // }, [blocksKey, ...]) // But depend on blocksKey, not coarseStaticBlocks
    //
    // This is a legitimate use case for eslint-disable because:
    // - We have a derived value (blocksKey) that better represents when to update
    // - The linter can't understand this semantic relationship
    // - The disable is narrow in scope and well-documented
    //
    // The alternative (using refs) adds complexity without benefit
    //
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocksKey, bpPerPx, majorColor, minorColor],
  )

  return blockElements
})

const Gridlines = observer(function ({
  model,
  offset = 0,
}: {
  model: LGV
  offset?: number
}) {
  const { classes } = useStyles()
  const containerRef = useRef<HTMLDivElement>(null)
  const guidesRef = useRef<HTMLDivElement>(null)

  // Use MobX reaction to update DOM directly without triggering React re-renders
  useEffect(() => {
    const container = containerRef.current
    const guides = guidesRef.current
    if (!container || !guides) {
      return
    }

    // MobX reaction tracks observables and updates DOM directly
    const disposer = reaction(
      () => ({
        scaleFactor: model.scaleFactor,
        offsetPx: model.offsetPx,
        blocksOffsetPx: model.coarseStaticBlocks?.offsetPx,
        totalWidthPx: model.coarseStaticBlocks?.totalWidthPx,
      }),
      ({ scaleFactor, offsetPx, blocksOffsetPx, totalWidthPx }) => {
        // Update scale transform
        container.style.transform =
          scaleFactor !== 1 ? `scaleX(${scaleFactor})` : ''

        // Update position and width
        if (blocksOffsetPx !== undefined && totalWidthPx !== undefined) {
          const translateX = blocksOffsetPx - offsetPx - offset
          guides.style.transform = `translateX(${translateX}px)`
          guides.style.width = `${totalWidthPx}px`
        }
      },
      { fireImmediately: true },
    )

    return disposer
  }, [model, offset])

  return (
    <div ref={containerRef} className={classes.verticalGuidesZoomContainer}>
      <div ref={guidesRef} className={classes.verticalGuidesContainer}>
        <RenderedVerticalGuides model={model} />
      </div>
    </div>
  )
})

export default Gridlines
