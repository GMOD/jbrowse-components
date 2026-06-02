import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import {
  localStorageGetBoolean,
  localStorageGetItem,
  localStorageGetNumber,
  localStorageSetItem,
} from '../../util/index.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

function localStorageSetNumber(key: string, value: number) {
  localStorageSetItem(key, JSON.stringify(value))
}

function localStorageSetBoolean(key: string, value: boolean) {
  localStorageSetItem(key, JSON.stringify(value))
}

export type ShowCoordinatesMode = 'none' | 'relative' | 'genomic'
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
      showCoordinatesSetting:
        localStorageGetItem(`${p}-showCoordinatesSetting`) || 'none',
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
