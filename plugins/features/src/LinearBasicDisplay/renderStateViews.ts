import type { RenderState } from './components/featureRenderingBackendTypes.ts'
import type { FeatureGroupSection } from './facet.ts'

/**
 * What the feature passes and the SVG export paint under: the scroll, the
 * canvas box and whether intron lines carry chevrons. The base model installs
 * it as a `.views()` layer; the static export's host installs the same.
 */
export function featureRenderStateViews(self: {
  scrollTop: number
  canvasWidthPx: number
  height: number
  showChevrons: boolean
}) {
  return {
    /**
     * #getter
     */
    get renderState(): RenderState {
      return {
        scrollY: self.scrollTop,
        canvasWidth: self.canvasWidthPx,
        canvasHeight: self.height,
        outlineColor: 0,
        hideChevrons: !self.showChevrons,
      }
    },
  }
}

/**
 * Whether the section chips draw, which the base model and the static
 * export's host both install over the band's `groupSections`.
 */
export function groupLabelViews(self: {
  groupSections: FeatureGroupSection[]
}) {
  return {
    /**
     * #getter
     * Whether the section chips and dividers draw: a grouping is set and
     * the layout produced a section for it.
     */
    get showsGroupLabels() {
      return self.groupSections.length > 0
    },
  }
}
