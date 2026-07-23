import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeResolutionSubMenuItem } from '@jbrowse/wiggle-core'
import GridOnIcon from '@mui/icons-material/GridOn'
import PaletteIcon from '@mui/icons-material/Palette'
import VisibilityIcon from '@mui/icons-material/Visibility'

import type { HicColorScheme } from './components/colorRamp.ts'
import type { MenuItem } from '@jbrowse/core/ui'

interface HicMenuSelf {
  useLogScale: boolean
  useColorPercentile: boolean
  showLegend: boolean
  showResolutionControls: boolean
  fitToHeight: boolean
  colorScheme: HicColorScheme
  availableResolutions: number[] | undefined
  availableNormalizations: string[] | undefined
  activeNormalization: string
  effectiveResolution: number | undefined
  effectiveResolutionIdx: number
  resolutionBias: number
  setUseLogScale: (f: boolean) => void
  setUseColorPercentile: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  setShowResolutionControls: (f: boolean) => void
  setFitToHeight: (f: boolean) => void
  setColorScheme: (s?: HicColorScheme) => void
  setActiveNormalization: (s: string) => void
  setResolution: (binSize: number) => void
  resetResolutionBias: () => void
}

// One-line explanation per matrix-balancing scheme, so the Normalization radios
// aren't bare jargon (KR/SCALE/VC/…). Falls back to a generic note for schemes
// a file might expose that we don't have specific copy for.
const NORM_HELP: Record<string, string> = {
  KR: 'Knight-Ruiz matrix balancing — the recommended normalization for most files.',
  SCALE: 'Fast matrix-balancing normalization that approximates KR.',
  VC: 'Vanilla coverage: divide each cell by its row and column contact sums.',
  VC_SQRT: 'Vanilla coverage using the square root of the row/column sums.',
  NONE: 'Raw observed contact counts, with no normalization applied.',
}

export function buildHicTrackMenuItems(self: HicMenuSelf): MenuItem[] {
  const avail = self.availableResolutions
  return [
    // Resolution sits at the top level (not buried behind the on-figure overlay
    // toggle) for discoverability — binsize is the primary Hi-C control. The
    // "Show resolution controls" checkbox below is a separate, opt-in on-figure
    // dropdown for baking a chosen binsize into a screenshot/figure.
    ...(avail?.length
      ? [
          makeResolutionSubMenuItem({
            icon: GridOnIcon,
            getState: () => ({
              label:
                self.effectiveResolution === undefined
                  ? ''
                  : getBpDisplayStr(self.effectiveResolution),
              finerDisabled: self.effectiveResolutionIdx <= 0,
              coarserDisabled: self.effectiveResolutionIdx >= avail.length - 1,
              resetDisabled: self.resolutionBias === 0,
            }),
            onFiner: () => {
              self.setResolution(avail[self.effectiveResolutionIdx - 1]!)
            },
            onCoarser: () => {
              self.setResolution(avail[self.effectiveResolutionIdx + 1]!)
            },
            onReset: () => {
              self.resetResolutionBias()
            },
            resetTitle: 'Back to auto (tracks zoom)',
          }),
        ]
      : []),
    {
      label: 'Show...',
      icon: VisibilityIcon,
      type: 'subMenu',
      subMenu: [
        {
          label: 'Show legend',
          type: 'checkbox',
          checked: self.showLegend,
          onClick: () => {
            self.setShowLegend(!self.showLegend)
          },
        },
        ...(avail
          ? [
              {
                label: 'Show resolution controls',
                helpText:
                  'Show an on-figure binsize dropdown in the track overlay, e.g. to bake a chosen resolution into a screenshot.',
                type: 'checkbox' as const,
                checked: self.showResolutionControls,
                onClick: () => {
                  self.setShowResolutionControls(!self.showResolutionControls)
                },
              },
            ]
          : []),
        {
          label: 'Fit to display height',
          helpText:
            'Squash the triangle vertically to fill the display height instead of drawing square bins at its natural half-width height.',
          type: 'checkbox',
          checked: self.fitToHeight,
          onClick: () => {
            self.setFitToHeight(!self.fitToHeight)
          },
        },
        {
          label: 'Log scale',
          helpText:
            'Map contact counts to color on a log2 scale, compressing the dynamic range so weaker contacts stay visible.',
          type: 'checkbox',
          checked: self.useLogScale,
          onClick: () => {
            self.setUseLogScale(!self.useLogScale)
          },
        },
        {
          label: 'Show faint contacts (95th percentile)',
          helpText:
            'Saturate the color scale at the 95th percentile of counts instead of the max, so faint off-diagonal contacts read more strongly.',
          type: 'checkbox',
          checked: self.useColorPercentile,
          onClick: () => {
            self.setUseColorPercentile(!self.useColorPercentile)
          },
        },
      ],
    },
    {
      label: 'Color scheme',
      icon: PaletteIcon,
      type: 'subMenu',
      subMenu: [
        {
          label: 'Juicebox (default)',
          type: 'radio',
          checked: self.colorScheme === 'juicebox',
          onClick: () => {
            self.setColorScheme(undefined)
          },
        },
        {
          label: 'Fall',
          type: 'radio',
          checked: self.colorScheme === 'fall',
          onClick: () => {
            self.setColorScheme('fall')
          },
        },
        {
          label: 'Viridis',
          type: 'radio',
          checked: self.colorScheme === 'viridis',
          onClick: () => {
            self.setColorScheme('viridis')
          },
        },
      ],
    },
    ...(self.availableNormalizations
      ? [
          {
            label: 'Normalization',
            type: 'subMenu' as const,
            subMenu: self.availableNormalizations.map(
              (norm): MenuItem => ({
                label: norm,
                type: 'radio',
                checked: norm === self.activeNormalization,
                helpText:
                  NORM_HELP[norm] ??
                  'Matrix normalization scheme provided by this .hic file.',
                onClick: () => {
                  self.setActiveNormalization(norm)
                },
              }),
            ),
          },
        ]
      : []),
  ]
}
