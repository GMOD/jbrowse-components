import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render } from '@testing-library/react'

import VariantFeatureDetails from './VariantFeatureWidget.tsx'
import { stateModelFactory } from './stateModelFactory.ts'

import type { VCFFeatureSerialized } from './types.ts'

function renderWidget(featureData: VCFFeatureSerialized) {
  const pluginManager = new PluginManager([])
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    { widget: { type: 'VariantFeatureWidget' } },
    { pluginManager },
  )
  model.widget.setFeatureData(featureData)
  return {
    ...render(
      <ThemeProvider theme={createJBrowseTheme()}>
        <VariantFeatureDetails model={model.widget} />
      </ThemeProvider>,
    ),
    widget: model.widget,
  }
}

test('renders with just the required model elements', () => {
  const { container } = renderWidget({
    uniqueId: 'hello',
    refName: 'ctgA',
    start: 176,
    end: 177,
    name: 'rs123',
    REF: 'A',
    ALT: ['<TRA>'],
    QUAL: 10.4,
    INFO: {
      MQ: [5],
    },
  })
  expect(container).toMatchSnapshot()
})

test('pairs each symbolic ALT with its own SVLEN', () => {
  const { container } = renderWidget({
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
  expect(container.textContent).toContain('<DEL> (100bp)')
  expect(container.textContent).toContain('<DUP> (200bp)')
})

test('shows the span for an SVLEN the header did not declare Integer', () => {
  // parseInfo only coerces to Number when the header gives Type=Integer/Float,
  // so an undeclared SVLEN arrives as strings, and '.' as undefined
  const { container } = renderWidget({
    uniqueId: 'hello',
    refName: 'ctgA',
    start: 176,
    end: 177,
    REF: 'A',
    ALT: ['<DEL>', '<DUP>'],
    INFO: {
      SVLEN: ['-100', undefined],
    },
  })
  expect(container.textContent).toContain('<DEL> (100bp)')
  expect(container.textContent).toContain('<DUP>')
  expect(container.textContent).not.toContain('<DUP> (')
})

test('shows the mate breakpoint, not a span, for a translocation', () => {
  const { container } = renderWidget({
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
  expect(container.textContent).toContain('<TRA> (ctgB:790,000,000)')
  expect(container.textContent).not.toContain('790Mbp')
})

test('lists each distinct breakend endpoint once, skipping mate-less ALTs', async () => {
  const { findByText, container } = renderWidget({
    uniqueId: 'hello',
    refName: 'ctgA',
    start: 176,
    end: 177,
    type: 'breakend',
    REF: 'A',
    // two ALTs pointing at the same mate, a mate-less single breakend, and a
    // plain allele from the same multiallelic record
    ALT: ['A[ctgB:100[', ']ctgB:100]A', '.A', 'AT'],
  })
  await findByText('ctgB:100')
  expect(container.querySelectorAll('li')).toHaveLength(1)
})

test('a breakend in a multiallelic record still gets the breakend panel', async () => {
  const { findByText } = renderWidget({
    uniqueId: 'hello',
    refName: 'ctgA',
    start: 176,
    end: 177,
    // multiallelic records carry the comma-joined SO terms of every ALT
    type: 'breakend,deletion',
    REF: 'A',
    ALT: ['A[ctgB:100[', '<DEL>'],
  })
  await findByText('ctgB:100')
})

test('clicking the next variant resets the previous one local UI state', async () => {
  // the widget instance is reused per track, so the details subtree has to be
  // keyed by feature or state like the ALT toggle (and the sample grid's
  // filters) carries over to a variant it was never set on
  const longAllele = { REF: 'ACGTACGTACGTA', ALT: ['TGCATGCATGCAT'] }
  const { findByText, getByText, widget } = renderWidget({
    uniqueId: 'variantA',
    refName: 'ctgA',
    start: 176,
    end: 189,
    ...longAllele,
  })
  fireEvent.click(getByText('Show raw ALT'))
  await findByText('Show simplified ALT')

  widget.setFeatureData({
    uniqueId: 'variantB',
    refName: 'ctgA',
    start: 300,
    end: 313,
    ...longAllele,
  })
  await findByText('Show raw ALT')
})

test('a breakend whose ALTs name no mate offers no navigation', async () => {
  const { container, findByText } = renderWidget({
    uniqueId: 'hello',
    refName: 'ctgA',
    start: 176,
    end: 177,
    type: 'breakend',
    REF: 'A',
    // the symbolic-mate form: parseBreakend answers it with a '<DEL>:1'
    // placeholder, which names no contig
    ALT: ['A<DEL>'],
  })
  await findByText('ALT')
  expect(container.textContent).not.toContain('Breakends')
  expect(container.querySelectorAll('li')).toHaveLength(0)
})

// The widget is a singleton the drawer reuses, and its body is keyed on
// uniqueId to reset the sample grid -- so the swap cue has to be mounted
// outside that key, or it remounts along with the body and never plays.
test('swapping to another variant washes the panel', () => {
  const { queryByTestId, widget } = renderWidget({
    uniqueId: 'one',
    refName: 'ctgA',
    start: 176,
    end: 177,
    REF: 'A',
    ALT: ['T'],
  })
  expect(queryByTestId('feature-details-wash')).toBeNull()

  act(() => {
    widget.setFeatureData({
      uniqueId: 'two',
      refName: 'ctgA',
      start: 300,
      end: 301,
      REF: 'C',
      ALT: ['G'],
    })
  })
  expect(queryByTestId('feature-details-wash')).toBeTruthy()
})

test('draws a <CNV:TR> record as a tandem repeat panel', async () => {
  const { findByTestId, getByText } = renderWidget({
    uniqueId: 'kiv2',
    refName: 'chr6',
    start: 160616002,
    end: 160616003,
    name: 'KIV-2',
    REF: 'A',
    ALT: ['<CNV:TR>'],
    INFO: {
      SVLEN: [30],
      RN: [1],
      RUS: ['ACGTACGTAC'],
      RUC: [3],
      RB: [30],
    },
    samples: { HG00128: { GT: ['1|0'] } },
  })
  await findByTestId('tandem-repeat-view')
  expect(getByText('Tandem repeat')).toBeTruthy()
  expect(getByText('HG00128#1')).toBeTruthy()
  expect(getByText('HG00128#2')).toBeTruthy()
})

test('a copy number record stating no repeat gets no tandem repeat panel', () => {
  const { queryByText } = renderWidget({
    uniqueId: 'cnv',
    refName: 'chr6',
    start: 100,
    end: 5100,
    REF: 'A',
    ALT: ['<CNV>'],
    INFO: { SVLEN: [5000] },
  })
  expect(queryByText('Tandem repeat')).toBeNull()
})

const cohort = Object.fromEntries(
  Array.from({ length: 40 }, (_, i) => [
    `S${i}`,
    { GT: [i < 10 ? '1|1' : '0|0'] },
  ]),
)

const cohortRecord = {
  uniqueId: 'cohort',
  refName: 'chr6',
  start: 160616002,
  end: 160616003,
  name: 'KIV-2',
  REF: 'A',
  ALT: ['<CNV:TR>'],
  INFO: {
    SVLEN: [30],
    RN: [1],
    RUS: ['ACGTACGTAC'],
    RUC: [3],
    RB: [30],
  },
  samples: cohort,
}

test('a cohort opens on one row per allele, not per sample', async () => {
  const { findByText, queryByText } = renderWidget(cohortRecord)
  await findByText('REF · 75%')
  expect(queryByText('ALT 1 · 25%')).toBeTruthy()
  expect(queryByText('S0#1')).toBeNull()
})

test('clicking an allele row narrows the Samples card to its carriers', async () => {
  const { findByText, getAllByTestId, getByText } = renderWidget(cohortRecord)
  await findByText('ALT 1 · 25%')
  const row = getAllByTestId('tandem-repeat-row').find(r =>
    r.textContent.startsWith('ALT 1 ·'),
  )!
  fireEvent.click(row)
  expect(getByText(/Samples \(10 of 40\) carrying ALT 1/)).toBeTruthy()
  fireEvent.click(row)
  expect(getByText('Samples (40)')).toBeTruthy()
})

test('a record with no ID does not repeat its locus in the panel header', async () => {
  const { findByTestId, getByText } = renderWidget({
    ...cohortRecord,
    uniqueId: 'anonymous',
    name: undefined,
    samples: { S1: { GT: ['1'] } },
  })
  await findByTestId('tandem-repeat-view')
  expect(
    getByText(
      (_, el) =>
        el?.tagName === 'P' &&
        el.textContent === 'chr6:160,616,004-160,616,033 · 1 haplotype',
    ),
  ).toBeTruthy()
})
