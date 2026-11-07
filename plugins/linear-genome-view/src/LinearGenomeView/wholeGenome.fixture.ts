import { createTestSession } from '@jbrowse/web/testUtils'

import type { LinearGenomeViewModel } from './index.ts'

function testReport(file: string) {
  return require.resolve(
    `../../../config/src/NcbiSequenceReportAliasAdapter/test_data/${file}`,
  )
}

export const contigs = [
  'chr1',
  'chr1_KI270706v1_random',
  'chr2',
  'chrM',
  'chrUn_GL000195v1',
  'chr1_GL383518v1_alt',
]

export const salmonellaContigs = ['chromosome', 'pSLT', 'unplaced_1']

async function openView({
  name,
  refNames,
  report,
}: {
  name: string
  refNames: string[]
  report?: string
}) {
  const session = createTestSession()
  session.addAssemblyConf({
    name,
    sequence: {
      trackId: `${name}-seq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: refNames.map(refName => ({
          refName,
          uniqueId: refName,
          start: 0,
          end: 10_000,
        })),
      },
    },
    ...(report
      ? {
          refNameAliases: {
            adapter: {
              type: 'NcbiSequenceReportAliasAdapter',
              location: {
                localPath: testReport(report),
                locationType: 'LocalPathLocation',
              },
            },
          },
        }
      : {}),
  })
  const assembly = await session.assemblyManager.waitForAssembly(name)
  const view = session.addView('LinearGenomeView', {}) as LinearGenomeViewModel
  view.setWidth(800)
  return { view, assembly }
}

export function openHg38View({ withReport }: { withReport: boolean }) {
  return openView({
    name: 'hg38',
    refNames: contigs,
    report: withReport ? 'sequence_report.tsv' : undefined,
  })
}

export function openSalmonellaView() {
  return openView({
    name: 'LT2',
    refNames: salmonellaContigs,
    report: 'salmonella_sequence_report.tsv',
  })
}
