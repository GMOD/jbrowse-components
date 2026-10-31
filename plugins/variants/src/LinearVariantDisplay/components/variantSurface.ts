import { eventPoint } from '@jbrowse/core/util/eventPoint'

import { variantTooltipKey } from './buildVariantHit.ts'

import type { VariantContextMenuInfo } from '../../shared/types.ts'
import type { VariantTooltipFields } from './buildVariantHit.ts'
import type { Feature } from '@jbrowse/core/util'
import type { MouseEvent } from 'react'

interface SurfaceModel {
  hoveredFeature?: { genotype: string; name: string }
  setHoveredFeature: (g?: VariantTooltipFields) => void
  clearHoveredFeature: () => void
  selectFeature: (f: Feature) => void
  clearSelection: () => void
  openContextMenu: (info: VariantContextMenuInfo) => void
}

/**
 * One pointer-responsive surface of a variant display — the
 * genotype rows or the matrix — in its own coordinate frame.
 * `getHit` takes a point relative to the surface's element; `enrich` turns a
 * hit into the `SimpleFeature` a click or a right-click acts on; `onHover`
 * writes whatever display-specific highlight state the surface keeps beside
 * the shared tooltip slot; `bandRecordId` names the record a right-click
 * keeps lit while its menu is open.
 */
export interface VariantSurface<H> {
  getHit: (x: number, y: number) => H | undefined
  getTooltip: (hit: H) => VariantTooltipFields
  enrich: (hit: H) => Feature | undefined
  onHover?: (hit: H | undefined) => void
  bandRecordId?: (hit: H) => string
}

/**
 * Hover a surface at a point — the display's `onPointerPosition` body, once
 * the outer component has resolved which surface the pointer is over.
 *
 * Deduped against the tooltip slot: a hit is a fresh object every frame, so
 * writing it unconditionally would re-render the tooltip per mousemove for a
 * cell that never changed. Keyed off the model rather than a ref, so a click
 * that clears the hover leaves nothing stale to compare against.
 */
export function hoverVariantSurface<H>(
  model: Pick<SurfaceModel, 'hoveredFeature' | 'setHoveredFeature'>,
  surface: VariantSurface<H>,
  x: number,
  y: number,
) {
  const hit = surface.getHit(x, y)
  const tooltip = hit ? surface.getTooltip(hit) : undefined
  const current = model.hoveredFeature
  if (
    (tooltip && variantTooltipKey(tooltip)) !==
    (current && variantTooltipKey(current))
  ) {
    model.setHoveredFeature(tooltip)
    surface.onHover?.(hit)
  }
}

/**
 * The click and right-click handlers for a surface's element. Both hit-test
 * from their own event rather than the stored hover: the hover is a frame
 * behind by construction (`useMouseTracking` coalesces), and a gesture that
 * read it would act on the wrong cell. Both drop the hover first so the
 * tooltip does not linger behind the widget or the menu; a click on nothing
 * clears the selection, as a feature track's does.
 *
 * Typed to `HTMLElement`, not the canvas, so a surface can bind them on a
 * transparent div over an `OverlayCanvas` (`pointerEvents: none`).
 */
export function variantSurfaceHandlers<H>(
  model: SurfaceModel,
  surface: VariantSurface<H>,
) {
  function featureAt(e: MouseEvent<HTMLElement>) {
    const { x, y } = eventPoint(e)
    const hit = surface.getHit(x, y)
    const feature = hit ? surface.enrich(hit) : undefined
    return hit && feature ? { hit, feature } : undefined
  }
  return {
    onClick(e: MouseEvent<HTMLElement>) {
      const found = featureAt(e)
      if (found) {
        model.clearHoveredFeature()
        model.selectFeature(found.feature)
      } else {
        model.clearSelection()
      }
    },
    onContextMenu(e: MouseEvent<HTMLElement>) {
      const found = featureAt(e)
      if (found) {
        e.preventDefault()
        model.clearHoveredFeature()
        model.openContextMenu({
          clientX: e.clientX,
          clientY: e.clientY,
          feature: found.feature,
          bandRecordId: surface.bandRecordId?.(found.hit),
        })
      }
    },
  }
}
