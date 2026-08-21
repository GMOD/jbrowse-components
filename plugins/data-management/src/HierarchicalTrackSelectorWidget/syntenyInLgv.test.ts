import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { HierarchicalTrackSelectorModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

type TestSession = ReturnType<typeof createTestSession>

function assemblyConf(name: string) {
  return {
    name,
    sequence: {
      trackId: `${name}-seq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'c' },
        ],
      },
    },
  }
}

// assemblyNames is ordered [query, target]; a synteny track is offerable from
// either end, so these fixtures put the assembly under test in both positions
function syntenyConf(trackId: string, assemblyNames: string[]) {
  return {
    trackId,
    name: trackId,
    type: 'SyntenyTrack',
    assemblyNames,
    adapter: {
      type: 'PAFAdapter',
      assemblyNames,
      pafLocation: { uri: 'test.paf' },
    },
  }
}

async function setup() {
  const session = createTestSession({ adminMode: true })
  for (const name of ['hg38', 'hg19', 'mm10', 'rn7']) {
    session.addAssemblyConf(assemblyConf(name))
  }
  session.addSessionTrackConf(syntenyConf('hg19_vs_hg38', ['hg19', 'hg38']))
  session.addSessionTrackConf(syntenyConf('hg38_vs_mm10', ['hg38', 'mm10']))
  session.addSessionTrackConf(syntenyConf('mm10_vs_rn7', ['mm10', 'rn7']))
  session.addSessionTrackConf(
    syntenyConf('allVsAll', ['hg38', 'hg19', 'mm10', 'rn7']),
  )
  session.addSessionTrackConf(syntenyConf('selfHg38', ['hg38', 'hg38']))
  const { assemblyManager } = session
  await when(
    () =>
      assemblyManager.assemblies.length ===
      assemblyManager.assemblyNamesList.length,
  )
  return session
}

function offeredBy(session: TestSession, assemblyName: string) {
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [{ assemblyName, refName: 'ctgA', start: 0, end: 1000 }],
  })
  const model = view.activateTrackSelector() as HierarchicalTrackSelectorModel
  return model.allTracks
    .flatMap(g => g.tracks.map(t => t.conf.trackId as string))
    .filter(id => !id.endsWith('-seq'))
    .toSorted()
}

// A SyntenyTrack registers LGVSyntenyDisplay against LinearGenomeView, so
// synteny tracks appear in an ordinary LGV's track selector on purpose. Which
// ones is the part that has been doubted: it is every track naming the view's
// assembly, at either end of the pair, and nothing else.
test('an LGV offers exactly the synteny tracks naming its assembly', async () => {
  const session = await setup()
  expect(offeredBy(session, 'hg38')).toEqual([
    'allVsAll',
    'hg19_vs_hg38',
    'hg38_vs_mm10',
    'selfHg38',
  ])
  expect(offeredBy(session, 'mm10')).toEqual([
    'allVsAll',
    'hg38_vs_mm10',
    'mm10_vs_rn7',
  ])
  // rn7 is in the all-vs-all set and in one pairwise track, and in neither of
  // the two human ones
  expect(offeredBy(session, 'rn7')).toEqual(['allVsAll', 'mm10_vs_rn7'])
})

// The rule for a one-assembly view is "the track names this assembly", which is
// what `containsAll` reduces to when there is one name to contain. The
// every-assembly rule only ever bites a view showing several (a synteny level, a
// breakpoint split), so it is not what governs this list.
test('a synteny track for two other assemblies is never offered', async () => {
  const session = await setup()
  expect(offeredBy(session, 'hg19')).not.toContain('mm10_vs_rn7')
  expect(offeredBy(session, 'hg19')).not.toContain('hg38_vs_mm10')
})
