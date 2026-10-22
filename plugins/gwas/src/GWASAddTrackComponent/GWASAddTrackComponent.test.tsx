import { types } from '@jbrowse/mobx-state-tree'
import { fireEvent, render } from '@testing-library/react'

import GWASAddTrackComponent from './GWASAddTrackComponent.tsx'

// the add-track widget's slice the component reads and writes
const WidgetStub = types
  .model({
    mixinData: types.frozen<Record<string, unknown>>({}),
    workflowForms: types.frozen<Record<string, object | undefined>>({}),
  })
  .views(() => ({
    get assembly() {
      return 'hg38'
    },
    get trackAdapterType() {
      return 'GWASAdapter'
    },
  }))
  .actions(self => ({
    setAssembly() {},
    setMixinData(data: Record<string, unknown>) {
      self.mixinData = data
    },
    setWorkflowForm(key: string, form: object) {
      self.workflowForms = { ...self.workflowForms, [key]: form }
    },
  }))

test('the score fields reach the track config, take it back on unmount, and come back on remount', () => {
  const model = WidgetStub.create()
  const first = render(<GWASAddTrackComponent model={model} />)
  expect(model.mixinData).toEqual({ adapter: {} })

  fireEvent.change(first.getByLabelText('Score column'), {
    target: { value: 'pval' },
  })
  expect(model.mixinData).toEqual({ adapter: { scoreColumn: 'pval' } })

  first.unmount()
  expect(model.mixinData).toEqual({})

  const second = render(<GWASAddTrackComponent model={model} />)
  expect(model.mixinData).toEqual({ adapter: { scoreColumn: 'pval' } })
  expect(second.getByLabelText('Score column')).toHaveProperty('value', 'pval')
})
