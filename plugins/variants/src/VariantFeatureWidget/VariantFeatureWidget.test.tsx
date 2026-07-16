import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import VariantFeatureDetails from './VariantFeatureWidget.tsx'
import { stateModelFactory } from './stateModelFactory.ts'

test('renders with just the required model elements', () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'VariantFeatureWidget',
      },
    },
    { pluginManager },
  )
  model.widget.setFeatureData({
    uniqueId: 'hello',
    refName: 'ctgA',
    start: 176,
    end: 177,
    name: 'rs123',
    REF: 'A',
    ALT: ['<TRA>'],
    QUAL: 10.4,
    INFO: {
      MQ: 5,
    },
  })

  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <VariantFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  expect(container).toMatchSnapshot()
})

test('pairs each symbolic ALT with its own SVLEN', () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'VariantFeatureWidget',
      },
    },
    { pluginManager },
  )
  model.widget.setFeatureData({
    uniqueId: 'hello',
    refName: 'ctgA',
    start: 176,
    end: 177,
    REF: 'A',
    ALT: ['<DEL>', '<DUP>'],
    INFO: {
      SVLEN: [-100, 200],
    },
  })

  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <VariantFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  expect(container.textContent).toContain('<DEL> (100bp)')
  expect(container.textContent).toContain('<DUP> (200bp)')
})

test('shows the mate breakpoint, not a span, for a translocation', () => {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    {
      widget: {
        type: 'VariantFeatureWidget',
      },
    },
    { pluginManager },
  )
  model.widget.setFeatureData({
    uniqueId: 'hello',
    refName: 'ctgA',
    start: 176,
    end: 177,
    REF: 'A',
    ALT: ['<TRA>'],
    INFO: {
      CHR2: ['ctgB'],
      END: [790000000],
      SVLEN: [790000000],
    },
  })

  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <VariantFeatureDetails model={model.widget} />
    </ThemeProvider>,
  )
  expect(container.textContent).toContain('<TRA> (ctgB:790,000,000)')
  expect(container.textContent).not.toContain('790Mbp')
})
