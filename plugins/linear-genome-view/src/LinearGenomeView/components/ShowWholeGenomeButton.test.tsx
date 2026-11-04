import { createTestSession } from '@jbrowse/web/testUtils'
import { fireEvent, render } from '@testing-library/react'

import ShowWholeGenomeButton from './ShowWholeGenomeButton.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const report =
  require.resolve('../../../../config/src/NcbiSequenceReportAliasAdapter/test_data/sequence_report.tsv')

const contigs = [
  'chr1',
  'chr1_KI270706v1_random',
  'chr2',
  'chrM',
  'chrUn_GL000195v1',
  'chr1_GL383518v1_alt',
]

async function renderButton(withReport: boolean) {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'hg38',
    sequence: {
      trackId: 'hg38-seq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: contigs.map(refName => ({
          refName,
          uniqueId: refName,
          start: 0,
          end: 10_000,
        })),
      },
    },
    ...(withReport
      ? {
          refNameAliases: {
            adapter: {
              type: 'NcbiSequenceReportAliasAdapter',
              location: {
                localPath: report,
                locationType: 'LocalPathLocation',
              },
            },
          },
        }
      : {}),
  })
  await session.assemblyManager.waitForAssembly('hg38')
  const view = session.addView('LinearGenomeView', {}) as LinearGenomeViewModel
  view.setWidth(800)
  const utils = render(
    <ShowWholeGenomeButton
      model={view}
      assemblyName="hg38"
      disabled={false}
      className=""
    />,
  )
  return { view, ...utils }
}

test('the dropdown at its end shows every region the chromosomes leave out', async () => {
  const { view, getByText, getByTestId, findByText } = await renderButton(true)
  getByText('Show all chromosomes')
  fireEvent.click(getByTestId('show-whole-genome-more'))
  fireEvent.click(await findByText('Show all 6 regions'))
  expect(view.displayedRegions.map(r => r.refName)).toEqual(contigs)
})

test('the button itself shows the chromosomes', async () => {
  const { view, getByText } = await renderButton(true)
  fireEvent.click(getByText('Show all chromosomes'))
  expect(view.displayedRegions.map(r => r.refName)).toEqual(['chr1', 'chr2'])
})

test('an assembly stating no roles gets a plain button with no dropdown', async () => {
  const { getByText, queryByTestId } = await renderButton(false)
  getByText('Show all regions in assembly')
  expect(queryByTestId('show-whole-genome-more')).toBeNull()
})
