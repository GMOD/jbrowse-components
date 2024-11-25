import React from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'
import { types } from 'mobx-state-tree'

// locals
import ReactComponent from './AlignmentsFeatureDetail'
import { stateModelFactory } from './stateModelFactory'

test('open up a widget', () => {
  const pluginManager = new PluginManager([])

  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const session = Session.create(
    {
      // @ts-expect-error
      widget: { type: 'AlignmentsFeatureWidget' },
    },
    { pluginManager },
  )
  session.widget.setFeatureData({
    seq: 'TTGTTGCGGAGTTGAACAACGGCATTAGGAACACTTCCGTCTCTCACTTTTATACGATTATGATTGGTTCTTTAGCCTTGGTTTAGATTGGTAGTAGTAG',
    start: 2,
    end: 102,
    strand: 1,
    score: 37,
    qual: '17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17',
    MQ: 37,
    CIGAR: '100M',
    length_on_ref: 100,
    template_length: 0,
    seq_length: 100,
    name: 'ctgA_3_555_0:0:0_2:0:0_102d',
    refName: 'ctgA',
    type: 'match',
  })
  const { container, getByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ReactComponent model={session.widget} />,
    </ThemeProvider>,
  )
  expect(container).toMatchSnapshot()
  expect(getByText('ctgA:3..102 (+)')).toBeTruthy()
})
