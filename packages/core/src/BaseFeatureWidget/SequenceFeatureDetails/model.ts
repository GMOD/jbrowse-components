import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

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
      /**
       * #volatile
       * genomic base currently hovered in the sequence panel, or undefined
       */
      hoverPosition: undefined as SequenceHoverPosition | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setUpDownBp(f: number) {
        self.upDownBp = f
      },
      /**
       * #action
       */
      setIntronBp(f: number) {
        self.intronBp = f
      },
      /**
       * #action
       */
      setUpperCaseCDS(f: boolean) {
        self.upperCaseCDS = f
      },
      /**
       * #action
       */
      setShowCoordinates(f: ShowCoordinatesMode) {
        self.showCoordinatesSetting = f
      },
      /**
       * #action
       */
      setHoverPosition(pos: SequenceHoverPosition | undefined) {
        // skip no-op updates: mousemove fires per pixel but the base under the
        // cursor changes far less often, and each change re-renders the LGV
        // crosshair overlay
        const prev = self.hoverPosition
        const same =
          prev === pos ||
          (prev?.refName === pos?.refName &&
            prev?.start === pos?.start &&
            prev?.end === pos?.end)
        if (!same) {
          self.hoverPosition = pos
        }
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
    .actions(self => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(
            function sequenceFeatureLocalStorageAutorun() {
              localStorageSetNumber(`${p}-upDownBp`, self.upDownBp)
              localStorageSetNumber(`${p}-intronBp`, self.intronBp)
              localStorageSetBoolean(`${p}-upperCaseCDS`, self.upperCaseCDS)
              localStorageSetItem(
                `${p}-showCoordinatesSetting`,
                self.showCoordinatesSetting,
              )
            },
            { name: 'SequenceFeatureLocalStorage' },
          ),
        )
      },
    }))
}

export type SequenceFeatureDetailsStateModel = ReturnType<
  typeof SequenceFeatureDetailsF
>
export type SequenceFeatureDetailsModel =
  Instance<SequenceFeatureDetailsStateModel>
