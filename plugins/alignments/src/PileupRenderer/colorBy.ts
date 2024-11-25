import { readConfObject } from '@jbrowse/core/configuration'
import { fillColor } from '../shared/color'
import { orientationTypes } from '../util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

export function colorByInsertSize(feature: Feature) {
  return feature.get('is_paired') &&
    feature.get('refName') !== feature.get('next_ref')
    ? '#555'
    : `hsl(${Math.abs(feature.get('template_length')) / 10},50%,50%)`
}

export function colorByMappingQuality(feature: Feature) {
  return `hsl(${feature.get('score')},50%,50%)`
}

function getOrientation(feature: Feature, config: AnyConfigurationModel) {
  const orientationType = readConfObject(config, 'orientationType') as
    | 'fr'
    | 'ff'
    | 'rf'
  const type = orientationTypes[orientationType]
  const orientation = type[feature.get('pair_orientation') as string]!
  return {
    LR: 'color_pair_lr' as const,
    RR: 'color_pair_rr' as const,
    RL: 'color_pair_rl' as const,
    LL: 'color_pair_ll' as const,
  }[orientation]
}

export function colorByStrand(feature: Feature) {
  return feature.get('strand') === -1 ? '#8F8FD8' : '#EC8B8B'
}

export function colorByOrientation(
  feature: Feature,
  config: AnyConfigurationModel,
) {
  return fillColor[getOrientation(feature, config) || 'color_nostrand']
}
function getStranded(feature: Feature) {
  const flags = feature.get('flags')
  const strand = feature.get('strand')

  // is paired
  if (flags & 1) {
    // first-of-pair?
    const flipper = flags & 64 ? -1 : 1

    // proper pairing
    if (flags & 2) {
      return strand * flipper === 1 ? 'color_rev_strand' : 'color_fwd_strand'
    }
    // mate missing, separate color
    if (flags & 8) {
      return strand * flipper === 1
        ? 'color_rev_missing_mate'
        : 'color_fwd_missing_mate'
    }
    // same chrom without proper pairing gets separate color
    if (feature.get('refName') === feature.get('next_ref')) {
      return strand * flipper === 1
        ? 'color_rev_strand_not_proper'
        : 'color_fwd_strand_not_proper'
    }
    // abberant chrom

    return strand === 1 ? 'color_fwd_diff_chr' : 'color_rev_diff_chr'
  }
  return 'color_unknown'
}

export function colorByStrandedRnaSeq(feature: Feature) {
  return fillColor[getStranded(feature)]
}
