import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render } from '@testing-library/react'

import PluginManager from '../PluginManager.ts'
import {
  ConfigurationSchema,
  FormatDetailsConfigSchemaFactory,
} from '../configuration/index.ts'
import { createJBrowseTheme } from '../ui/index.ts'
import BaseFeatureDetails from './BaseFeatureDetail/index.tsx'
import { stateModelFactory } from './index.ts'

test('open up a widget', async () => {
  const pluginManager = new PluginManager([])

  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'BaseFeatureWidget',
      },
    },
    { pluginManager },
  )
  const { container, findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  act(() => {
    model.widget.setFeatureData({
      uniqueId: 'hello',
      start: 2,
      end: 102,
      strand: 1,
      score: 37,
      refName: 'ctgA',
    })
  })
  expect(await findByText('ctgA:3..102 (+)')).toBeTruthy()
  expect(container).toMatchSnapshot()
})

// `configuration.formatDetails` is the session-wide tier of the same callbacks a
// track carries. The widget's track is a safeReference: it can be absent because
// nothing opened the widget from a track, or because the track was closed while
// the widget stayed open. The global callbacks still have to run.
test('session-level formatDetails applies with no track', async () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {
      formatDetails: FormatDetailsConfigSchemaFactory(),
    }),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      configuration: {
        formatDetails: {
          feature: "jexl:{sessionField:'from the session config'}",
        },
      },
      widget: { type: 'BaseFeatureWidget' },
    },
    { pluginManager },
  )
  const { findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  act(() => {
    model.widget.setFeatureData({
      uniqueId: 'hello',
      start: 2,
      end: 102,
      refName: 'ctgA',
    })
  })
  expect(await findByText('sessionField')).toBeTruthy()
  expect(await findByText('from the session config')).toBeTruthy()
})

// The panel is reused rather than remounted when another feature is clicked
// (see SequenceFeatureDetailsRemount.test.tsx), so nothing about the drawer
// itself says the click landed. Note the swap has to happen on a mounted tree:
// re-rendering a fresh one would restart the cue for free.
test('a feature swap washes the panel, and a re-format of the same feature does not', async () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'BaseFeatureWidget',
        unformattedFeatureData: {
          uniqueId: 'one',
          refName: 'ctgA',
          start: 2,
          end: 102,
        },
      },
    },
    { pluginManager },
  )
  const { queryByTestId, findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  expect(await findByText('ctgA:3..102')).toBeTruthy()
  expect(queryByTestId('feature-details-wash')).toBeNull()

  act(() => {
    model.widget.setFeatureData({
      uniqueId: 'one',
      refName: 'ctgA',
      start: 2,
      end: 102,
      extra: 'reformatted',
    })
  })
  expect(await findByText('reformatted')).toBeTruthy()
  expect(queryByTestId('feature-details-wash')).toBeNull()

  act(() => {
    model.widget.setFeatureData({
      uniqueId: 'two',
      refName: 'ctgA',
      start: 200,
      end: 300,
    })
  })
  expect(await findByText('ctgA:201..300')).toBeTruthy()
  expect(queryByTestId('feature-details-wash')).toBeTruthy()
})

// A BEDPE, breakend or PAF feature carries its other end as `mate`, whose
// position the Mate details section already shows
test("the mate's fields render once, under Mate details", async () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'BaseFeatureWidget',
        unformattedFeatureData: {
          uniqueId: 'bp1',
          refName: 'ctgA',
          start: 10,
          end: 20,
          mate: { refName: 'ctgB', start: 100, end: 101, assemblyName: 'hg2' },
        },
      },
    },
    { pluginManager },
  )
  const { findByText, queryByText, getAllByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  expect(await findByText('Mate details')).toBeTruthy()
  expect(queryByText('mate.start')).toBeNull()
  expect(queryByText('mate.refName')).toBeNull()
  expect(getAllByText('mate.assemblyName')).toHaveLength(1)
})

// A transcript clicked inside a gene opens the panel on the transcript alone,
// and its card is headed `NM_004006.2 - mRNA` -- nothing there says DMD. The
// display resolves the containing feature at click time (see
// parentFeatureSummary) and the panel names it above the card.
test('the panel names the feature it was reached through', async () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'BaseFeatureWidget',
        unformattedFeatureData: {
          uniqueId: 'mRNA1',
          refName: 'ctgA',
          start: 2,
          end: 102,
          name: 'NM_004006.2',
          type: 'mRNA',
        },
        parentFeature: { name: 'DMD', type: 'gene' },
      },
    },
    { pluginManager },
  )
  const { findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  expect(await findByText('in gene DMD')).toBeTruthy()
})

// Every other feature in the tree is clicked as itself, and a line above the
// card is only noise there.
test('the panel says nothing about a parent it was not given', async () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'BaseFeatureWidget',
        unformattedFeatureData: {
          uniqueId: 'gene1',
          refName: 'ctgA',
          start: 2,
          end: 102,
        },
      },
    },
    { pluginManager },
  )
  const { queryByTestId, findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  expect(await findByText('ctgA:3..102')).toBeTruthy()
  expect(queryByTestId('parent-feature-line')).toBeNull()
})

test('the sequence panel reads the feature before formatDetails rewrote it', async () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {
      formatDetails: FormatDetailsConfigSchemaFactory(),
    }),
    widget: stateModelFactory(pluginManager),
  })
  const transcript = (name: string, cdsEnd: number) => ({
    name,
    refName: 'ctgA',
    start: 0,
    end: 100,
    type: 'mRNA',
    subfeatures: [
      { refName: 'ctgA', start: 0, end: 100, type: 'exon' },
      { refName: 'ctgA', start: 10, end: cdsEnd, type: 'CDS' },
    ],
  })
  const model = Session.create(
    {
      configuration: {
        formatDetails: {
          subfeatures: "jexl:{name:'Subfeature: '+feature.name}",
        },
      },
      widget: {
        type: 'BaseFeatureWidget',
        unformattedFeatureData: {
          uniqueId: 'g',
          name: 'EDEN',
          refName: 'ctgA',
          start: 0,
          end: 100,
          type: 'gene',
          subfeatures: [transcript('EDEN.1', 90), transcript('EDEN.2', 50)],
        },
      },
    },
    { pluginManager },
  )
  const { findAllByRole, findAllByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BaseFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  fireEvent.click((await findAllByText('Show feature sequence'))[0]!)
  expect((await findAllByRole('combobox'))[0]!.textContent).toBe('EDEN.1')
})

test('a callback cannot replace subfeatures, which the sequence panel pairs by position', () => {
  const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {
      formatDetails: FormatDetailsConfigSchemaFactory(),
    }),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      configuration: {
        formatDetails: {
          feature: 'jexl:{subfeatures:[feature.subfeatures[1]]}',
        },
      },
      widget: {
        type: 'BaseFeatureWidget',
        unformattedFeatureData: {
          uniqueId: 'g',
          refName: 'ctgA',
          start: 0,
          end: 100,
          subfeatures: [
            { refName: 'ctgA', start: 0, end: 50 },
            { refName: 'ctgA', start: 50, end: 100 },
          ],
        },
      },
    },
    { pluginManager },
  )
  expect(`${model.widget.error}`).toContain('not replace them')
  expect(`${model.widget.error}`).toContain('the session configuration')
  reported.mockRestore()
})

test('a callback can still hide subfeatures', () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {
      formatDetails: FormatDetailsConfigSchemaFactory(),
    }),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      configuration: {
        formatDetails: { feature: 'jexl:{subfeatures:undefined}' },
      },
      widget: {
        type: 'BaseFeatureWidget',
        unformattedFeatureData: {
          uniqueId: 'g',
          refName: 'ctgA',
          start: 0,
          end: 100,
          subfeatures: [{ refName: 'ctgA', start: 0, end: 50 }],
        },
      },
    },
    { pluginManager },
  )
  expect(model.widget.error).toBeUndefined()
  expect(model.widget.featureData?.subfeatures).toBeUndefined()
})
