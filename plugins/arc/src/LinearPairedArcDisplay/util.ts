import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { Feature, AugmentedRegion } from '@jbrowse/core/util'
import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
import { IAnyStateTreeNode, addDisposer, isAlive } from 'mobx-state-tree'
import { IAutorunOptions, autorun } from 'mobx'

// get tag from BAM or CRAM feature, where CRAM uses feature.get('tags') and
// BAM does not
export function getTag(feature: Feature, tag: string) {
  const tags = feature.get('tags')
  return tags !== undefined ? tags[tag] : feature.get(tag)
}

// use fallback alt tag, used in situations where upper case/lower case tags
// exist e.g. Mm/MM for base modifications
export function getTagAlt(feature: Feature, tag: string, alt: string) {
  return getTag(feature, tag) ?? getTag(feature, alt)
}

// orientation definitions from igv.js, see also
// https://software.broadinstitute.org/software/igv/interpreting_pair_orientations
export const orientationTypes = {
  ff: {
    F1F2: 'RL',
    F1R2: 'RR',

    F2F1: 'LR',
    F2R1: 'LL',

    R1F2: 'LL',
    R1R2: 'LR',

    R2F1: 'RR',
    R2R1: 'RL',
  } as Record<string, string>,

  fr: {
    F1F2: 'LL',
    F1R2: 'LR',

    F2F1: 'LL',
    F2R1: 'LR',

    R1F2: 'RL',
    R1R2: 'RR',

    R2F1: 'RL',
    R2R1: 'RR',
  } as Record<string, string>,

  rf: {
    F1F2: 'RR',
    F1R2: 'RL',

    F2F1: 'RR',
    F2R1: 'RL',

    R1F2: 'LR',
    R1R2: 'LL',

    R2F1: 'LR',
    R2R1: 'LL',
  } as Record<string, string>,
}

export const pairMap = {
  LL: 'color_pair_ll',
  LR: 'color_pair_lr',
  RL: 'color_pair_rl',
  RR: 'color_pair_rr',
} as const

export function getColorWGBS(strand: number, base: string) {
  if (strand === 1) {
    if (base === 'C') {
      return '#f00'
    }
    if (base === 'T') {
      return '#00f'
    }
  } else if (strand === -1) {
    if (base === 'G') {
      return '#f00'
    }
    if (base === 'A') {
      return '#00f'
    }
  }
  return '#888'
}

// fetches region sequence augmenting by +/- 1bp for CpG on either side of
// requested region
export async function fetchSequence(
  region: AugmentedRegion,
  adapter: BaseFeatureDataAdapter,
) {
  const { start, end, originalRefName, refName } = region

  const feats = await firstValueFrom(
    adapter
      .getFeatures({
        ...region,
        end: end + 1,
        refName: originalRefName || refName,
        start: Math.max(0, start - 1),
      })
      .pipe(toArray()),
  )
  return feats[0]?.get('seq')
}

// has to check underlying C-G (aka CpG) on the reference sequence
export function shouldFetchReferenceSequence(type?: string) {
  return type === 'methylation'
}

// adapted from IGV
// https://github.com/igvteam/igv/blob/e803e3af2d8c9ea049961dfd4628146bdde9a574/src/main/java/org/broad/igv/sam/mods/BaseModificationColors.java#L27
export const modificationColors = {
  b: 'rgb(202, 71, 47)',
  c: 'rgb(157, 216, 102)',
  e: 'rgb(141, 221, 208)',
  f: 'rgb(246, 200, 95)',
  g: 'rgb(255, 160, 86)',
  h: 'rgb(11, 132, 165)',
  m: 'rgb(255,0,0)',
  o: 'rgb(111, 78, 129)',
} as Record<string, string | undefined>

type DisplayModel = IAnyStateTreeNode & { setError: (arg: unknown) => void }

export function createAutorun(
  self: DisplayModel,
  cb: () => Promise<void>,
  opts?: IAutorunOptions,
) {
  addDisposer(
    self,
    autorun(async () => {
      try {
        await cb()
      } catch (e) {
        if (isAlive(self)) {
          self.setError(e)
        }
      }
    }, opts),
  )
}
export function randomColor() {
  return `hsl(${Math.random() * 200}, 50%, 50%)`
}
