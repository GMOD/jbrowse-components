import { types, addDisposer, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'

// locals
import { localStorageGetItem, localStorageSetItem } from '../../util'

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
      width: 100,
      mode: '',
    }))
    .views(self => ({
      get showCoordinates() {
        return self.showCoordinatesSetting !== 'none'
      },
      get showGenomicCoordsOption() {
        return self.mode === 'gene' || self.mode === 'gene_updownstream'
      },
    }))
    .actions(self => ({
      setUpDownBp(f: number) {
        self.upDownBp = f
      },
      setIntronBp(f: number) {
        self.intronBp = f
      },
      setUpperCaseCDS(f: boolean) {
        self.upperCaseCDS = f
      },
      setShowCoordinates(f: 'none' | 'relative' | 'genomic') {
        self.showCoordinatesSetting = f
      },
      setMode(mode: string) {
        self.mode = mode
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
      },
    }))
}

export type SequenceFeatureDetailsStateModel = ReturnType<
  typeof SequenceFeatureDetailsF
>
export type SequenceFeatureDetailsModel =
  Instance<SequenceFeatureDetailsStateModel>
