import { addDisposer, getParent, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { modificationData } from './shared/modificationData'

import type { ColorBy, FilterBy, ModificationTypeWithColor } from './shared/types'
import type { ObservableMap } from 'mobx'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { AugmentedRegion, Feature } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { IAutorunOptions } from 'mobx'

export interface ParentDisplaySettings {
  colorBy?: ColorBy
  filterBy?: FilterBy
  visibleModifications?: ObservableMap<string, ModificationTypeWithColor>
  simplexModifications?: Set<string>
  modificationsReady?: boolean
}

/**
 * Gets the parent display if this display is nested.
 * Used by PileupDisplay and SNPCoverageDisplay when they're inside LinearAlignmentsDisplay.
 *
 * IMPORTANT: To maintain MobX reactivity, always access properties (colorBy, filterBy, etc.)
 * directly on the returned parent object within the same reactive context (getter/computed).
 */
export function getParentDisplay(self: unknown): ParentDisplaySettings | undefined {
  try {
    const parent = getParent<any>(self, 1)
    // Check if this looks like a parent display (has colorBy/filterBy getters)
    if (parent && ('colorBy' in parent || 'filterBy' in parent)) {
      return parent as ParentDisplaySettings
    }
  } catch {
    // Not nested in a parent display
  }
  return undefined
}

/**
 * @deprecated Use getParentDisplay instead for proper MobX reactivity
 */
export function getParentDisplaySettings(
  self: unknown,
): ParentDisplaySettings | undefined {
  return getParentDisplay(self)
}

/**
 * Returns true if this display is nested inside a parent display
 * (e.g., PileupDisplay inside LinearAlignmentsDisplay)
 */
export function isNestedDisplay(self: unknown): boolean {
  return getParentDisplaySettings(self) !== undefined
}

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

type DisplayModel = IAnyStateTreeNode & { setError?: (arg: unknown) => void }

export function createAutorun(
  self: DisplayModel,
  cb: () => Promise<void>,
  opts?: IAutorunOptions,
) {
  addDisposer(
    self,
    autorun(async function sharedAlignmentsAutorun() {
      try {
        await cb()
      } catch (e) {
        if (isAlive(self)) {
          self.setError?.(e)
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

export { modificationData } from './shared/modificationData'
