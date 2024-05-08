import { types, addDisposer, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'

// locals
import { localStorageGetItem, localStorageSetItem } from '../../util'

export function SequenceFeatureDetailsF() {
  return types
    .model('SequenceFeatureDetails', {})
    .volatile(() => ({
      showCoordinates: Boolean(
        JSON.parse(
          localStorageGetItem('sequenceFeatureDetails-showCoordinates') ||
            'true',
        ),
      ),
      intronBp: +(localStorageGetItem('sequenceFeatureDetails-intronBp') ?? 10),
      upDownBp: +(
        localStorageGetItem('sequenceFeatureDetails-upDownBp') ?? 100
      ),
      upperCaseCDS: Boolean(
        JSON.parse(
          localStorageGetItem('sequenceFeatureDetails-upperCaseCDS') || 'true',
        ),
      ),
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
      setShowCoordinates(f: boolean) {
        self.showCoordinates = f
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
              'sequenceFeatureDetails-showCoordinates',
              JSON.stringify(self.showCoordinates),
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
