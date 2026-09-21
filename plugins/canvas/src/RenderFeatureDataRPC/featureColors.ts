import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'

// What the `color`/`utrColor` slots resolve to when unset and the feature
// carries no BED color of its own. Pure fallbacks, never compared against a
// stored value. They live in core because the multi-sample variant display's
// lane paints an uncolored record with the same goldenrod.
export const FEATURE_DEFAULT_COLOR = featureDefaultColor
export const UTR_DEFAULT_COLOR = utrDefaultColor
