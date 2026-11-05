import { createTestSession } from '@jbrowse/web/testUtils'

import type { LinearGenomeViewModel } from './index.ts'

const report =
  require.resolve('../../../config/src/NcbiSequenceReportAliasAdapter/test_data/sequence_report.tsv')

export const contigs = [
  'chr1',
  'chr1_KI270706v1_random',
  'chr2',
  'chrM',
  'chrUn_GL000195v1',
  'chr1_GL383518v1_alt',
]

export async function openHg38View({ withReport }: { withReport: boolean }) {
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
  const assembly = await session.assemblyManager.waitForAssembly('hg38')
  const view = session.addView('LinearGenomeView', {}) as LinearGenomeViewModel
  view.setWidth(800)
  return { view, assembly }
}
