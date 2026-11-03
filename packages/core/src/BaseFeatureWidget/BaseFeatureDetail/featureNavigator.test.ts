import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from '../../configuration/index.ts'
import { featureNavigator } from './featureNavigator.ts'

import type { FeatureDetailsModel } from '../types.tsx'

function setup(navTo: (loc: unknown, grow?: number) => void) {
  const navToLocString = jest.fn(() => Promise.resolve(true))
  const view = { assemblyNames: ['hg38'], navTo, navToLocString }
  const Widget = types.model('W', {}).volatile(() => ({ view }))
  const Session = types
    .model({
      rpcManager: types.optional(types.frozen(), {}),
      configuration: ConfigurationSchema('test', {}),
      widget: types.optional(Widget, {}),
    })
    .volatile(() => ({
      assemblyManager: {
        has: (name: string) => name === 'hg38' || name === 'mm10',
        getCanonicalAssemblyName: (name: string) => name,
      },
      notifyError: jest.fn(),
    }))
  const session = Session.create({})
  // the navigator reads only `view` off the widget
  const model = session.widget as unknown as FeatureDetailsModel
  return { locate: featureNavigator(model)!, navToLocString }
}

const feature = { uniqueId: 'f', refName: 'chr1', start: 10, end: 20 }

test('navTo keeps the region list when the feature is displayed', () => {
  const navTo = jest.fn()
  const { locate, navToLocString } = setup(navTo)
  locate(feature)!()
  expect(navTo).toHaveBeenCalledWith(
    { refName: 'chr1', start: 10, end: 20, assemblyName: 'hg38' },
    0.1,
  )
  expect(navToLocString).not.toHaveBeenCalled()
})

test('a feature outside every displayed region falls back to its locus', () => {
  const { locate, navToLocString } = setup(() => {
    throw new Error('could not find a region')
  })
  locate(feature)!()
  expect(navToLocString).toHaveBeenCalledWith('chr1:11..20', 'hg38', 0.1)
})

test('a feature on an assembly the view does not show gets no link', () => {
  const { locate } = setup(jest.fn())
  expect(locate({ ...feature, assemblyName: 'mm10' })).toBeUndefined()
})
