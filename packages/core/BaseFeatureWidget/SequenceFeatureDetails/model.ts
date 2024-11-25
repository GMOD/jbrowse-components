import { autorun } from 'mobx'
import { types, addDisposer } from 'mobx-state-tree'

// locals
import { localStorageGetItem, localStorageSetItem } from '../../util'
import type { SimpleFeatureSerialized } from '../../util'
import type { Instance } from 'mobx-state-tree'

function localStorageGetNumber(key: string, defaultVal: number) {
  return +(localStorageGetItem(key) ?? defaultVal)
}

function localStorageGetBoolean(key: string, defaultVal: boolean) {
  return Boolean(
    JSON.parse(localStorageGetItem(key) || JSON.stringify(defaultVal)),
  )
}

function localStorageSetNumber(key: string, value: number) {
  localStorageSetItem(key, JSON.stringify(value))
}

function localStorageSetBoolean(key: string, value: boolean) {
  localStorageSetItem(key, JSON.stringify(value))
}

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
      mode: '',
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
      setShowCoordinates(f: 'none' | 'relative' | 'genomic') {
        self.showCoordinatesSetting = f
      },
      /**
       * #action
       */
      setMode(mode: string) {
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
        return self.feature?.subfeatures?.some(sub => sub.type === 'CDS')
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
          autorun(() => {
            localStorageSetNumber(`${p}-upDownBp`, self.upDownBp)
            localStorageSetNumber(`${p}-intronBp`, self.intronBp)
            localStorageSetBoolean(`${p}-upperCaseCDS`, self.upperCaseCDS)
            localStorageSetItem(
              `${p}-showCoordinatesSetting`,
              self.showCoordinatesSetting,
            )
          }),
        )
        addDisposer(
          self,
          autorun(() => {
            self.setMode(
              self.hasCDS ? 'cds' : self.hasExon ? 'cdna' : 'genomic',
            )
          }),
        )
      },
    }))
}

export type SequenceFeatureDetailsStateModel = ReturnType<
  typeof SequenceFeatureDetailsF
>
export type SequenceFeatureDetailsModel =
  Instance<SequenceFeatureDetailsStateModel>
