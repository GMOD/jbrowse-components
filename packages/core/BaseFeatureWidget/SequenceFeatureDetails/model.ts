import { types, addDisposer, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'

// locals
import {
  SimpleFeatureSerialized,
  localStorageGetItem,
  localStorageSetItem,
} from '../../util'

function localStorageGetNumber(key: string, defaultVal: number) {
  return +(localStorageGetItem(key) ?? defaultVal)
}

export function SequenceFeatureDetailsF() {
  return types
    .model('SequenceFeatureDetails')
    .volatile(() => ({
      showCoordinatesSetting:
        localStorageGetItem('sequenceFeatureDetails-showCoordinatesSetting') ||
        'none',
      intronBp: localStorageGetNumber('sequenceFeatureDetails-intronBp', 10),
      upDownBp: localStorageGetNumber('sequenceFeatureDetails-upDownBp', 100),
      upperCaseCDS: Boolean(
        JSON.parse(
          localStorageGetItem('sequenceFeatureDetails-upperCaseCDS') || 'true',
        ),
      ),
      charactersPerRow: 100,
      feature: undefined as SimpleFeatureSerialized | undefined,
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
        return self.mode === 'gene' || self.mode === 'gene_updownstream'
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
            localStorageSetItem(
              'sequenceFeatureDetails-upDownBp',
              JSON.stringify(self.upDownBp),
            )
            localStorageSetItem(
              'sequenceFeatureDetails-intronBp',
              JSON.stringify(self.intronBp),
            )
            localStorageSetItem(
              'sequenceFeatureDetails-upperCaseCDS',
              JSON.stringify(self.upperCaseCDS),
            )
            localStorageSetItem(
              'sequenceFeatureDetails-showCoordinatesSetting',
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
