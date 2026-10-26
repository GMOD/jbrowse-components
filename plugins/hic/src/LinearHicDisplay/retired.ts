import type { RetiredDisplayState } from '@jbrowse/core/pluggableElementTypes'

// v4's defaults, which every snapshot of it wrote, lift to nothing
const V4_HEIGHT_MODES: Record<string, string | undefined> = { adjust: 'fit' }
const V4_NORMALIZATION = 'KR'

/**
 * The picture a v4.3.0 share link's Hi-C display held as instance state,
 * lifted into the config slots that hold it now. v4's `resolution` doubled
 * the binsize density per menu step, so its log2 is the step count; the Log
 * toggle wrote `useLogScale`, which is `symlog` as the toggle writes today.
 * v4 ran every scheme low to high as written, viridis dark at the low counts,
 * so a lifted scheme pins `reverse` off.
 */
export const retiredState: RetiredDisplayState = {
  keys: [
    'resolution',
    'useLogScale',
    'colorScheme',
    'activeNormalization',
    'mode',
    'showLegend',
  ],
  lift: ({
    resolution,
    useLogScale,
    colorScheme,
    activeNormalization,
    mode,
    showLegend,
  }) => {
    const steps =
      typeof resolution === 'number' && resolution > 0
        ? Math.round(Math.log2(resolution))
        : 0
    const scale = {
      ...(useLogScale === true ? { type: 'symlog' } : {}),
      ...(typeof colorScheme === 'string'
        ? { scheme: colorScheme, reverse: false }
        : {}),
    }
    const data = {
      ...(steps === 0 ? {} : { resolution: steps }),
      ...(typeof activeNormalization === 'string' &&
      activeNormalization !== V4_NORMALIZATION
        ? { normalization: activeNormalization }
        : {}),
    }
    const heightMode =
      typeof mode === 'string' ? V4_HEIGHT_MODES[mode] : undefined
    return {
      ...(Object.keys(scale).length ? { encoding: { color: { scale } } } : {}),
      ...(Object.keys(data).length ? { data } : {}),
      ...(heightMode ? { heightMode } : {}),
      ...(typeof showLegend === 'boolean'
        ? { legend: { show: showLegend } }
        : {}),
    }
  },
}
