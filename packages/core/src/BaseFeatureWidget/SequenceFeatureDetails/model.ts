import { types } from '@jbrowse/mobx-state-tree'

import {
  localStorageGetBoolean,
  localStorageGetItem,
  localStorageGetNumber,
  localStorageSetBoolean,
  localStorageSetItem,
  localStorageSetNumber,
} from '../../util/index.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

export type ShowCoordinatesMode = 'none' | 'relative' | 'genomic'

function parseShowCoordinatesMode(
  val: string | undefined,
): ShowCoordinatesMode {
  return val === 'relative' || val === 'genomic' ? val : 'none'
}

// a single genomic base the user is hovering in the sequence panel, published
// so a connected LinearGenomeView can draw a crosshair at that position (see
// the LGV SequenceFeatureHoverHighlight overlay). start/end are 0-based/BED.
export interface SequenceHoverPosition {
  refName: string
  start: number
  end: number
  assemblyName?: string
}

// What the sequence panel needs from whoever opened it in order to publish
// hovers: the widget or display that owns the panel, which is the tree node the
// LGV crosshair overlay can find. A caller with nowhere to draw omits it.
export interface SequenceHoverTarget {
  setSequenceHoverPosition: (pos: SequenceHoverPosition | undefined) => void
}

export type SequenceDisplayMode =
  | 'gene'
  | 'gene_collapsed_intron'
  | 'gene_updownstream'
  | 'gene_updownstream_collapsed_intron'
  | 'cdna'
  | 'cds'
  | 'genomic'
  | 'genomic_sequence_updownstream'
  | 'protein'

const p = 'sequenceFeatureDetails'

// User preferences for the sequence readout, seeded from and written straight
// back to localStorage. Nothing here is snapshotted or reads the tree, so an
// instance is cheap and needs no lifecycle: a holder that only sometimes shows
// a panel (e.g. a track's right-click dialog) creates one when it opens rather
// than carrying it around.
export function SequenceFeatureDetailsF() {
  return types
    .model('SequenceFeatureDetails')
    .volatile(() => ({
      /**
       * #volatile
       */
      showCoordinatesSetting: parseShowCoordinatesMode(
        localStorageGetItem(`${p}-showCoordinatesSetting`) ?? undefined,
      ),
      /**
       * #volatile
       */
      intronBp: localStorageGetNumber(`${p}-intronBp`, 10),
      /**
       * #volatile
       */
      upDownBp: localStorageGetNumber(`${p}-upDownBp`, 100),
      /**
       * #volatile
       */
      upperCaseCDS: localStorageGetBoolean(`${p}-upperCaseCDS`, true),
      /**
       * #volatile
       */
      charactersPerRow: 100,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setUpDownBp(f: number) {
        self.upDownBp = f
        localStorageSetNumber(`${p}-upDownBp`, f)
      },
      /**
       * #action
       */
      setIntronBp(f: number) {
        self.intronBp = f
        localStorageSetNumber(`${p}-intronBp`, f)
      },
      /**
       * #action
       */
      setUpperCaseCDS(f: boolean) {
        self.upperCaseCDS = f
        localStorageSetBoolean(`${p}-upperCaseCDS`, f)
      },
      /**
       * #action
       */
      setShowCoordinates(f: ShowCoordinatesMode) {
        self.showCoordinatesSetting = f
        localStorageSetItem(`${p}-showCoordinatesSetting`, f)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get showCoordinates() {
        return self.showCoordinatesSetting !== 'none'
      },
    }))
}

export type SequenceFeatureDetailsStateModel = ReturnType<
  typeof SequenceFeatureDetailsF
>
export type SequenceFeatureDetailsModel =
  Instance<SequenceFeatureDetailsStateModel>
