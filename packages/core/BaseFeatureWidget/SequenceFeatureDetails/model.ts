import { types, addDisposer, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'

// locals
import { localStorageGetItem, localStorageSetItem } from '../../util'

export function SequenceFeatureDetailsF() {
  return types
    .model('SequenceFeatureDetails')
    .volatile(() => ({
      showCoordinates2:
        localStorageGetItem('sequenceFeatureDetails-showCoordinates2') ||
        'none',
      intronBp: +(localStorageGetItem('sequenceFeatureDetails-intronBp') ?? 10),
      upDownBp: +(
        localStorageGetItem('sequenceFeatureDetails-upDownBp') ?? 100
      ),
      upperCaseCDS: Boolean(
        JSON.parse(
          localStorageGetItem('sequenceFeatureDetails-upperCaseCDS') || 'true',
        ),
      ),
      width: 100,
    }))
    .views(self => ({
      get showCoordinates() {
        return self.showCoordinates2 !== 'none'
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
      setShowCoordinates(f: string) {
        self.showCoordinates2 = f
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
              'sequenceFeatureDetails-showCoordinates2',
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
