import * as utilIndex from './index.ts'
import { openFeatureWidget } from './openFeatureWidget.ts'
import * as typesIndex from './types/index.ts'

import type { Widget } from './types/index.ts'

function makeSession() {
  const widget: Widget = { type: 'BaseFeatureWidget', id: 'baseFeature' }
  return {
    configuration: {},
    setSelection: jest.fn(),
    addWidget: jest.fn(() => widget),
    showWidget: jest.fn(),
  }
}

type MockSession = ReturnType<typeof makeSession>

const node = {} as object
const view = { id: 'v1' }
const track = { id: 't1' }

function mockEnv(session: MockSession) {
  jest.spyOn(utilIndex, 'getSession').mockReturnValue(session as never)
  jest.spyOn(utilIndex, 'getContainingView').mockReturnValue(view as never)
  jest.spyOn(utilIndex, 'getContainingTrack').mockReturnValue(track as never)
  jest.spyOn(typesIndex, 'isSessionModelWithWidgets').mockReturnValue(true)
}

afterEach(() => {
  jest.restoreAllMocks()
})

test('opens BaseFeatureWidget by default with view/track context', () => {
  const session = makeSession()
  mockEnv(session)
  const featureData = { uniqueId: 'x', refName: '1', start: 0, end: 10 }
  const widget = openFeatureWidget(node, featureData)
  expect(widget).toBeDefined()
  expect(session.addWidget).toHaveBeenCalledWith(
    'BaseFeatureWidget',
    'baseFeature',
    {
      featureData,
      view,
      track,
    },
  )
  expect(session.showWidget).toHaveBeenCalledWith(widget)
})

test('sets session selection to a feature wrapping the featureData', () => {
  const session = makeSession()
  mockEnv(session)
  const featureData = { uniqueId: 'q', refName: '1', start: 5, end: 6 }
  openFeatureWidget(node, featureData)
  expect(session.setSelection).toHaveBeenCalledTimes(1)
  const passed = session.setSelection.mock.calls[0]![0] as {
    get: (k: string) => unknown
    id: () => string
  }
  expect(passed.id()).toBe('q')
  expect(passed.get('refName')).toBe('1')
  expect(passed.get('start')).toBe(5)
})

test('returns undefined when the session does not host widgets', () => {
  const session = makeSession()
  jest.spyOn(utilIndex, 'getSession').mockReturnValue(session as never)
  jest.spyOn(typesIndex, 'isSessionModelWithWidgets').mockReturnValue(false)
  const widget = openFeatureWidget(node, {
    uniqueId: 'x',
    refName: '1',
    start: 0,
    end: 1,
  })
  expect(widget).toBeUndefined()
  expect(session.addWidget).not.toHaveBeenCalled()
  expect(session.showWidget).not.toHaveBeenCalled()
})

test('honors widget override and extra initialState', () => {
  const session = makeSession()
  mockEnv(session)
  const featureData = { uniqueId: 'x', refName: '1', start: 0, end: 1 }
  openFeatureWidget(node, featureData, {
    widget: { type: 'AlignmentsFeatureWidget', id: 'alignmentFeature' },
    extra: { descriptions: { score: 'p-value' } },
  })
  expect(session.addWidget).toHaveBeenCalledWith(
    'AlignmentsFeatureWidget',
    'alignmentFeature',
    {
      featureData,
      view,
      track,
      descriptions: { score: 'p-value' },
    },
  )
})
