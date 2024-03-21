import React from 'react'
import { render } from '@testing-library/react'
import { types } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

// locals
import { stateModelFactory } from './stateModelFactory'
import ReactComponent from './AlignmentsFeatureDetail'

test('open up a widget', () => {
  const pluginManager = new PluginManager([])

  const Session = types.model({
    configuration: ConfigurationSchema('test', {}),
    rpcManager: types.optional(types.frozen(), {}),
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
    CIGAR: '100M',
    MQ: 37,
    end: 102,
    length_on_ref: 100,
    name: 'ctgA_3_555_0:0:0_2:0:0_102d',
    qual: '17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17',
    refName: 'ctgA',
    score: 37,
    seq: 'TTGTTGCGGAGTTGAACAACGGCATTAGGAACACTTCCGTCTCTCACTTTTATACGATTATGATTGGTTCTTTAGCCTTGGTTTAGATTGGTAGTAGTAG',
    seq_length: 100,
    start: 2,
    strand: 1,
    template_length: 0,
    type: 'match',
  })
  const { container, getByText } = render(
    <ReactComponent model={session.widget} />,
  )
  expect(container).toMatchSnapshot()
  expect(getByText('ctgA:3..102 (+)')).toBeTruthy()
})
