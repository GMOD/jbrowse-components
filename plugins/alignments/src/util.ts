import { autorun } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, AugmentedRegion } from '@jbrowse/core/util'
import type { IAutorunOptions } from 'mobx'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

// use fallback alt tag, used in situations where upper case/lower case tags
// exist e.g. Mm/MM for base modifications
export function getTagAlt(feature: Feature, tag: string, alt: string) {
  const tags = feature.get('tags')
  return tags[tag] ?? tags[alt]
}

// orientation definitions from igv.js, see also
// https://software.broadinstitute.org/software/igv/interpreting_pair_orientations
export const orientationTypes = {
  fr: {
    F1R2: 'LR',
    F2R1: 'LR',

    F1F2: 'LL',
    F2F1: 'LL',

    R1R2: 'RR',
    R2R1: 'RR',

    R1F2: 'RL',
    R2F1: 'RL',
  } as Record<string, string>,

  rf: {
    R1F2: 'LR',
    R2F1: 'LR',

    R1R2: 'LL',
    R2R1: 'LL',

    F1F2: 'RR',
    F2F1: 'RR',

    F1R2: 'RL',
    F2R1: 'RL',
  } as Record<string, string>,

  ff: {
    F2F1: 'LR',
    R1R2: 'LR',

    F2R1: 'LL',
    R1F2: 'LL',

    R2F1: 'RR',
    F1R2: 'RR',

    R2R1: 'RL',
    F1F2: 'RL',
  } as Record<string, string>,
}

export const pairMap = {
  LR: 'color_pair_lr',
  LL: 'color_pair_ll',
  RR: 'color_pair_rr',
  RL: 'color_pair_rl',
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

export async function fetchSequence(
  region: AugmentedRegion,
  adapter: BaseFeatureDataAdapter,
) {
  const { start, end, originalRefName, refName } = region

  const feats = await firstValueFrom(
    adapter
      .getFeatures({
        ...region,
        refName: originalRefName || refName,
        end,
        start,
      })
      .pipe(toArray()),
  )
  return feats[0]?.get('seq')
}

interface ModificationData {
  color: string
  name: string
}

// adapted from IGV
// https://github.com/igvteam/igv/blob/af07c3b1be8806cfd77343ee04982aeff17d2beb/src/main/resources/org/broad/igv/prefs/preferences.tab#L230-L242
export const modificationData = {
  m: { color: 'rgb(255,0,0)', name: '5mC' },
  h: { color: 'rgb(255,0,255)', name: '5hmC' },
  o: { color: 'rgb(111, 78, 129)', name: '8oxoG' },
  f: { color: 'rgb(246, 200, 95)', name: '5fC' },
  c: { color: 'rgb(157, 216, 102)', name: '5cac' },
  g: { color: 'rgb(255, 160, 86)', name: '5hmu' },
  e: { color: 'rgb(141, 221, 208)', name: '5fU' },
  b: { color: 'rgb(0,100,47)', name: '5caU' },
  a: { color: 'rgb(51,0,111)', name: '6mA' },
  17082: { color: 'rgb(51,153,255)', name: 'pseU' },
  17596: { color: 'rgb(102,153,0)', name: 'inosine' },
  21839: { color: 'rgb(153,0,153)', name: '4mC' },
} as Record<string, ModificationData>

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

export function randomColor(str: string) {
  let sum = 0

  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  return `hsl(${sum * 10}, 20%, 50%)`
}

export function getColorForModification(str: string) {
  return modificationData[str]?.color || randomColor(str)
}
