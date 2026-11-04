import { createTestSession } from '@jbrowse/web/testUtils'

import { showWholeGenomeLabel } from './showWholeGenomeLabel.ts'

import type { LinearGenomeViewModel } from './index.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const report =
  require.resolve('../../../config/src/NcbiSequenceReportAliasAdapter/test_data/sequence_report.tsv')

const contigs = [
  'chr1',
  'chr1_KI270706v1_random',
  'chr2',
  'chrM',
  'chrUn_GL000195v1',
  'chr1_GL383518v1_alt',
]

function addAssembly(
  session: ReturnType<typeof createTestSession>,
  name: string,
  withReport: boolean,
) {
  session.addAssemblyConf({
    name,
    sequence: {
      trackId: `${name}-seq`,
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
}

async function showWholeGenome(withReport: boolean) {
  const session = createTestSession()
  addAssembly(session, 'hg38', withReport)
  const assembly = await session.assemblyManager.waitForAssembly('hg38')
  const view = session.addView('LinearGenomeView', {}) as LinearGenomeViewModel
  view.setWidth(800)
  view.showAllRegionsInAssembly('hg38')
  return {
    shown: view.displayedRegions.map(r => r.refName),
    label: showWholeGenomeLabel(assembly),
  }
}

test('an assembly whose sequence report states roles shows its chromosomes', async () => {
  expect(await showWholeGenome(true)).toEqual({
    shown: ['chr1', 'chr2'],
    label: 'Show all chromosomes',
  })
})

test('an assembly stating no roles shows every region', async () => {
  expect(await showWholeGenome(false)).toEqual({
    shown: contigs,
    label: 'Show all regions in assembly',
  })
})
