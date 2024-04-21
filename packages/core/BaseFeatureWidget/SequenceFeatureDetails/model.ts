import { types, addDisposer, Instance } from 'mobx-state-tree'
import { autorun } from 'mobx'

// locals
import { localStorageGetItem, localStorageSetItem } from '../../util'

export function SequenceFeaturePanelF() {
  return types
    .model('SequenceFeaturePanel', {})
    .volatile(() => ({
      intronBp: +(localStorageGetItem('sequenceFeaturePanel-intronBp') ?? 10),
      upDownBp: +(localStorageGetItem('sequenceFeaturePanel-upDownBp') ?? 100),
      upperCaseCDS: Boolean(
        JSON.parse(
          localStorageGetItem('sequenceFeaturePanel-upperCaseCDS') || 'true',
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
          }),
        )
      },
    }))
}

export type SequenceFeatureDetailsStateModel = ReturnType<
  typeof stateModelFactory
>
export type SequenceFeatureDetailsModel =
  Instance<SequenceFeatureDetailsStateModel>
