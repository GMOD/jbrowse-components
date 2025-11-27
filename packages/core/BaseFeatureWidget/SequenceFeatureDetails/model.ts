import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'

import {
  localStorageGetBoolean,
  localStorageGetItem,
  localStorageGetNumber,
  localStorageSetItem,
} from '../../util'

import type { SimpleFeatureSerialized } from '../../util'
import type { Instance } from 'mobx-state-tree'

function localStorageSetNumber(key: string, value: number) {
  localStorageSetItem(key, JSON.stringify(value))
}

function localStorageSetBoolean(key: string, value: boolean) {
  localStorageSetItem(key, JSON.stringify(value))
}

type ShowCoordinatesMode = 'none' | 'relative' | 'genomic'
type SequenceDisplayMode =
  | ''
  | 'gene'
  | 'gene_collapsed_intron'
  | 'gene_updownstream'
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
      /**
       * #volatile
       */
      feature: undefined as SimpleFeatureSerialized | undefined,
      /**
       * #volatile
       */
      mode: '' as SequenceDisplayMode,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setFeature(f: SimpleFeatureSerialized) {
        self.feature = f
      },
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
      setMode(mode: SequenceDisplayMode) {
        self.mode = mode
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get showCoordinates() {
        return self.showCoordinatesSetting !== 'none'
      },
      /**
       * #getter
       */
      get showGenomicCoordsOption() {
        return (
          self.mode === 'gene' ||
          self.mode === 'gene_updownstream' ||
          self.mode === 'genomic' ||
          self.mode === 'genomic_sequence_updownstream'
        )
      },
      /**
       * #getter
       */
      get hasCDS() {
        return self.feature?.subfeatures?.some(
          sub => sub.type?.toLowerCase() === 'cds',
        )
      },
      /**
       * #getter
       */
      get hasExon() {
        return self.feature?.subfeatures?.some(sub => sub.type === 'exon')
      },
      /**
       * #getter
       */
      get hasExonOrCDS() {
        return this.hasExon || this.hasCDS
      },
    }))
    .actions(self => ({
      afterAttach() {
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
        addDisposer(
          self,
          autorun(
            function sequenceFeatureModeAutorun() {
              self.setMode(
                self.hasCDS ? 'cds' : self.hasExon ? 'cdna' : 'genomic',
              )
            },
            { name: 'SequenceFeatureMode' },
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
