import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../../PluginManager.ts'
import {
  ConfigurationSchema,
  readConfObject,
} from '../../configuration/index.ts'
import DisplayType from '../DisplayType.ts'
import TrackType from '../TrackType.ts'
import { createBaseTrackConfig } from './index.ts'

import type { AnyConfigurationModel } from '../../configuration/index.ts'

// A track with two displays whose color slots differ ('color' vs 'strokeColor'),
// to exercise slot-name routing of the `displayDefaults: {...}` object shorthand
// end to end through real config creation.
function makePluginManager() {
  const pluginManager = new PluginManager()
  pluginManager.addTrackType(
    () =>
      new TrackType({
        name: 'FeatureTrack',
        configSchema: ConfigurationSchema(
          'FeatureTrack',
          {},
          {
            baseConfiguration: createBaseTrackConfig(pluginManager),
            explicitIdentifier: 'trackId',
          },
        ),
        stateModel: types.model('FeatureTrack', {}),
      }),
  )
  const displayType = (name: string, colorSlot: string) =>
    new DisplayType({
      name,
      configSchema: ConfigurationSchema(
        name,
        { [colorSlot]: { type: 'color', defaultValue: 'goldenrod' } },
        { explicitIdentifier: 'displayId', explicitlyTyped: true },
      ),
      stateModel: types.model(name, {}),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: () => null,
    })
  pluginManager.addDisplayType(() => displayType('LinearBasicDisplay', 'color'))
  pluginManager.addDisplayType(() =>
    displayType('ChordVariantDisplay', 'strokeColor'),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

function createTrack(snapshot: Record<string, unknown>) {
  const pluginManager = makePluginManager()
  const TrackConfig = pluginManager.getTrackType('FeatureTrack').configSchema
  return TrackConfig.create(snapshot, {
    pluginManager,
  }) as AnyConfigurationModel & {
    displays: AnyConfigurationModel[]
  }
}

function display(conf: { displays: AnyConfigurationModel[] }, type: string) {
  const found = conf.displays.find(d => readConfObject(d, 'type') === type)
  if (!found) {
    throw new Error(`display ${type} not found`)
  }
  return found
}

test('displayDefaults routes a slot to the display that defines it', () => {
  const conf = createTrack({
    trackId: 'mytrack',
    type: 'FeatureTrack',
    displayDefaults: { color: 'green' },
  })
  expect(readConfObject(display(conf, 'LinearBasicDisplay'), 'color')).toBe(
    'green',
  )
})

test('settings route by slot name across displays', () => {
  const conf = createTrack({
    trackId: 'mytrack',
    type: 'FeatureTrack',
    displayDefaults: { color: 'green', strokeColor: 'red' },
  })
  expect(readConfObject(display(conf, 'LinearBasicDisplay'), 'color')).toBe(
    'green',
  )
  expect(
    readConfObject(display(conf, 'ChordVariantDisplay'), 'strokeColor'),
  ).toBe('red')
})

test('the explicit displays array form passes through untouched', () => {
  const conf = createTrack({
    trackId: 'mytrack',
    type: 'FeatureTrack',
    displays: [{ type: 'LinearBasicDisplay', displayId: 'd1', color: 'red' }],
  })
  expect(readConfObject(display(conf, 'LinearBasicDisplay'), 'color')).toBe(
    'red',
  )
  expect(readConfObject(display(conf, 'LinearBasicDisplay'), 'displayId')).toBe(
    'd1',
  )
})

test('displayDefaults folds into an explicit displays array (explicit wins)', () => {
  const conf = createTrack({
    trackId: 'mytrack',
    type: 'FeatureTrack',
    displays: [{ type: 'LinearBasicDisplay', displayId: 'd1', color: 'red' }],
    displayDefaults: { color: 'green', strokeColor: 'blue' },
  })
  // explicit array entry keeps its own color; the shorthand still reaches the
  // other display that defines strokeColor
  expect(readConfObject(display(conf, 'LinearBasicDisplay'), 'color')).toBe(
    'red',
  )
  expect(
    readConfObject(display(conf, 'ChordVariantDisplay'), 'strokeColor'),
  ).toBe('blue')
})

test('a jexl color expression routes through the shorthand', () => {
  const expr = "jexl:get(feature,'type')=='CDS'?'red':'blue'"
  const conf = createTrack({
    trackId: 'mytrack',
    type: 'FeatureTrack',
    displayDefaults: { color: expr },
  })
  // read the raw snapshot, not readConfObject, which would evaluate the jexl
  const snap = getSnapshot(display(conf, 'LinearBasicDisplay')) as {
    color?: string
  }
  expect(snap.color).toBe(expr)
})

test('a plain track with no displays still gets its display stub', () => {
  const conf = createTrack({ trackId: 'mytrack', type: 'FeatureTrack' })
  expect(readConfObject(display(conf, 'LinearBasicDisplay'), 'color')).toBe(
    'goldenrod',
  )
})
