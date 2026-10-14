import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

/** One label a display draws as text over its canvas, in the chrome's px. */
export interface FloatingLabel {
  key: string
  /** the text's left edge */
  x: number
  /** the text's top */
  y: number
  width: number
  text: string
  color: string
  fontSize: number
  /** the feature the label names, where it names one */
  featureId?: string
}

/**
 * A display whose labels are text laid over its canvas rather than painted
 * into it, answering them as records for a host that shows the canvas but not
 * the display's own DOM: a ring of the circular view samples the canvas alone.
 * Structural, shaped like `HighlightHost`.
 */
export interface FloatingLabelHost {
  floatingLabels: (palette: JBrowsePalette) => FloatingLabel[]
}

export function isFloatingLabelHost(model: object): model is FloatingLabelHost {
  return 'floatingLabels' in model
}

/** A feature's name and the box its body is drawn in, in the chrome's px. */
export interface NamedFeature {
  featureId: string
  text: string
  left: number
  top: number
  width: number
  height: number
}

/**
 * A display that answers every feature it draws by name, whether or not its
 * own label fit beside it: a host that places names on its own terms, as a
 * one-contig circle does outside its ring, reads these.
 */
export interface NamedFeatureHost {
  namedFeatures: NamedFeature[]
}

export function isNamedFeatureHost(model: object): model is NamedFeatureHost {
  return 'namedFeatures' in model
}
