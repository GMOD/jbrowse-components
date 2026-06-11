import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../../PluginManager.ts'
import { ConfigurationSchema, readConfObject } from '../../configuration/index.ts'
import DisplayType from '../DisplayType.ts'
import TrackType from '../TrackType.ts'
import ViewType from '../ViewType.ts'
import { createBaseTrackConfig } from './index.ts'

import type { AnyConfigurationModel } from '../../configuration/index.ts'

// A FeatureTrack-like setup with a LinearGenomeView display ('color' slot) and a
// CircularView display ('color' slot, declaring the 'cgv' abbreviation), to
// exercise both shorthand forms end-to-end through real config creation.
function makePluginManager() {
  const pluginManager = new PluginManager()
  const view = (name: string, abbreviation?: string) =>
    new ViewType({
      name,
      abbreviation,
      stateModel: types.model(name, {}),
      ReactComponent: () => null,
    })
  pluginManager.addViewType(() => view('LinearGenomeView'))
  pluginManager.addViewType(() => view('CircularView', 'cgv'))
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
  const display = (name: string, viewType: string) =>
    new DisplayType({
      name,
      configSchema: ConfigurationSchema(
        name,
        { color: { type: 'color', defaultValue: 'goldenrod' } },
        { explicitIdentifier: 'displayId', explicitlyTyped: true },
      ),
      stateModel: types.model(name, {}),
      trackType: 'FeatureTrack',
      viewType,
      ReactComponent: () => null,
    })
  pluginManager.addDisplayType(() => display('LinearBasicDisplay', 'LinearGenomeView'))
  pluginManager.addDisplayType(() => display('CircularChordDisplay', 'CircularView'))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

function createTrack(snapshot: Record<string, unknown>) {
  const pluginManager = makePluginManager()
  const TrackConfig = pluginManager.getTrackType('FeatureTrack').configSchema
  return TrackConfig.create(snapshot, { pluginManager }) as AnyConfigurationModel & {
    displays: AnyConfigurationModel[]
  }
}

function displayColor(
  conf: { displays: AnyConfigurationModel[] },
  type: string,
) {
  const display = conf.displays.find(d => readConfObject(d, 'type') === type)
  return display ? readConfObject(display, 'color') : undefined
}

test('flat top-level slot forwards to every display defining it', () => {
  const conf = createTrack({
    trackId: 'mytrack',
    type: 'FeatureTrack',
    color: 'green',
  })
  expect(displayColor(conf, 'LinearBasicDisplay')).toBe('green')
  expect(displayColor(conf, 'CircularChordDisplay')).toBe('green')
})

test('view-scoped object targets only its view, disambiguating displays', () => {
  const conf = createTrack({
    trackId: 'mytrack',
    type: 'FeatureTrack',
    lgv: { color: 'green' },
    cv: { color: 'blue' },
  })
  expect(displayColor(conf, 'LinearBasicDisplay')).toBe('green')
  expect(displayColor(conf, 'CircularChordDisplay')).toBe('blue')
})

test('view-scoped key accepts a declared abbreviation (cgv → CircularView)', () => {
  const conf = createTrack({
    trackId: 'mytrack',
    type: 'FeatureTrack',
    cgv: { color: 'blue' },
  })
  expect(displayColor(conf, 'CircularChordDisplay')).toBe('blue')
})

test('explicit displays array wins over shorthand on conflict', () => {
  const conf = createTrack({
    trackId: 'mytrack',
    type: 'FeatureTrack',
    color: 'green',
    displays: [{ type: 'LinearBasicDisplay', displayId: 'd1', color: 'red' }],
  })
  expect(displayColor(conf, 'LinearBasicDisplay')).toBe('red')
  // shorthand still reaches the non-conflicting display
  expect(displayColor(conf, 'CircularChordDisplay')).toBe('green')
})

test('shorthand keys are stripped from the resulting config', () => {
  const conf = createTrack({
    trackId: 'mytrack',
    type: 'FeatureTrack',
    color: 'green',
  })
  expect(conf).not.toHaveProperty('color')
})

test('a plain track with no shorthand still gets its display stub', () => {
  const conf = createTrack({ trackId: 'mytrack', type: 'FeatureTrack' })
  expect(displayColor(conf, 'LinearBasicDisplay')).toBe('goldenrod')
})
