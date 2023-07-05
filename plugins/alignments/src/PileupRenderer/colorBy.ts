import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { Feature } from '@jbrowse/core/util'
import { fillColor } from '../shared/color'
import { orientationTypes } from '../util'

export function colorByInsertSize(feature: Feature) {
  return feature.get('is_paired') &&
    feature.get('refName') !== feature.get('next_ref')
    ? '#555'
    : `hsl(${Math.abs(feature.get('template_length')) / 10},50%,50%)`
}

export function colorByMappingQuality(feature: Feature) {
  return `hsl(${feature.get('mq')},50%,50%)`
}

function getOrientation(feature: Feature, config: AnyConfigurationModel) {
  const orientationType = readConfObject(config, 'orientationType') as
    | 'fr'
    | 'ff'
    | 'rf'
  const type = orientationTypes[orientationType]
  const orientation = type[feature.get('pair_orientation') as string]
  return {
    LR: 'color_pair_lr' as const,
    RR: 'color_pair_rr' as const,
    RL: 'color_pair_rl' as const,
    LL: 'color_pair_ll' as const,
  }[orientation]
}

export function colorByStrand(
  feature: Feature,
  custom?: Record<string, string>,
) {
  return feature.get('strand') === -1
    ? (custom && custom['color_rev_strand']) ?? fillColor['color_rev_strand']
    : (custom && custom['color_fwd_strand']) ?? fillColor['color_fwd_strand']
}

export function colorByOrientation(
  feature: Feature,
  config: AnyConfigurationModel,
  custom?: Record<string, string>,
) {
  const colorPivot = custom ?? fillColor
  return colorPivot[getOrientation(feature, config) || 'color_nostrand']
}
function getStranded(feature: Feature) {
  const flags = feature.get('flags')
  const strand = feature.get('strand')
  // is paired
  if (flags & 1) {
    const revflag = flags & 64
    const flipper = revflag ? -1 : 1

    // proper pairing
    if (flags & 2) {
      return strand * flipper === 1 ? 'color_rev_strand' : 'color_fwd_strand'
    } else if (feature.get('multi_segment_next_segment_unmapped')) {
      return strand * flipper === 1
        ? 'color_rev_missing_mate'
        : 'color_fwd_missing_mate'
    } else if (feature.get('refName') === feature.get('next_refName')) {
      return strand * flipper === 1
        ? 'color_rev_strand_not_proper'
        : 'color_fwd_strand_not_proper'
    } else {
      // should only leave aberrant chr
      return strand === 1 ? 'color_fwd_diff_chr' : 'color_rev_diff_chr'
    }
  }
  return strand === 1 ? 'color_fwd_strand' : 'color_rev_strand'
}

export function colorByStrandedRnaSeq(
  feature: Feature,
  custom?: Record<string, string>,
) {
  const colorPivot = custom ?? fillColor
  return colorPivot[getStranded(feature)]
}
