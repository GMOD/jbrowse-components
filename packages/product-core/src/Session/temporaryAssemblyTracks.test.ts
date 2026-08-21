import { trackActionItems } from './TrackMenu.ts'
import { assertTrackConfOutlivesItsAssemblies } from './temporaryAssemblyTracks.ts'

import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

// The predicate this check asks is `@jbrowse/core/util`'s, and its own cases are
// pinned beside it in `core/util/temporaryAssembly.test.ts`. What is here is the
// two things built on top: the report, and the menu.
const SESSION = { temporaryAssemblies: [{ name: 'der_chr3_1' }] }

const SEGMENTS = {
  trackId: 'derivative-segments-1',
  type: 'FeatureTrack',
  assemblyNames: ['der_chr3_1'],
}
const HG38 = {
  trackId: 'my-genes',
  type: 'FeatureTrack',
  assemblyNames: ['hg38'],
}

test('the contract check names the destination and the fix', () => {
  assertTrackConfOutlivesItsAssemblies(SESSION, SEGMENTS, 'jbrowse.tracks')
  const [report, ...rest] = takeContractReports()
  expect(rest).toEqual([])
  expect(report).toContain('[jbrowse session contract]')
  expect(report).toContain('jbrowse.tracks')
  expect(report).toContain('derivative-segments-1')
  expect(report).toContain('inlineConf')
  expect(report).toContain('ADR-084')
})

test('the contract check stays quiet on a permanent assembly', () => {
  assertTrackConfOutlivesItsAssemblies(SESSION, HG38, 'jbrowse.tracks')
  expect(takeContractReports()).toEqual([])
})

// The bug the check found. "Copy track" stamps a fresh trackId onto a snapshot
// and hands it to `publishTrackConf`, which for an admin writes into the
// config.json every visitor is served — so a copy of a track on a synthetic
// assembly published one dead entry per click, naming an assembly that never
// existed outside the one session.
describe('the copy actions on a temporary-assembly track', () => {
  function items(config: object) {
    return trackActionItems({
      session: {
        ...SESSION,
        editConfiguration: () => {},
        publishTrackConf: () => undefined,
        deleteTrackConf: () => {},
      },
      config: config as BaseTrackConfig,
      view: { showTrack: () => {} },
      canEdit: true,
      makeCopy: () => ({ trackId: 'copy' }),
    })
  }
  const labelled = (config: object, label: string) =>
    items(config).find(i => 'label' in i && i.label === label)

  test('are offered on a permanent assembly', () => {
    expect(labelled(HG38, 'Copy track')).toHaveProperty('disabled', false)
    expect(labelled(HG38, 'Copy and open track')).toHaveProperty(
      'disabled',
      false,
    )
  })

  test('are refused on a temporary one', () => {
    expect(labelled(SEGMENTS, 'Copy track')).toHaveProperty('disabled', true)
    expect(labelled(SEGMENTS, 'Copy and open track')).toHaveProperty(
      'disabled',
      true,
    )
  })

  test('leave Settings and Delete alone', () => {
    expect(labelled(SEGMENTS, 'Settings')).toBeTruthy()
    expect(labelled(SEGMENTS, 'Delete track')).toHaveProperty('disabled', false)
  })
})
