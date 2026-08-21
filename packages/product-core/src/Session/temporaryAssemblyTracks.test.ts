import { trackActionItems } from './TrackMenu.ts'
import {
  assertTrackConfOutlivesItsAssemblies,
  namesTemporaryAssembly,
} from './temporaryAssemblyTracks.ts'

import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

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

test('a track on a temporary assembly is one', () => {
  expect(namesTemporaryAssembly(SESSION, SEGMENTS)).toBe(true)
})

test('a track on a permanent assembly is not', () => {
  expect(namesTemporaryAssembly(SESSION, HG38)).toBe(false)
})

// `some`, and this is the case that makes it the right question. A synteny band
// spans [the real reference, the synthetic read], so `every` would call it
// permanent — and it cannot be drawn either once the read assembly goes back.
// The sweep ADR-084 removed needed `every` because it DELETED; a question asked
// at the write has no such constraint.
test('a track spanning a temporary and a permanent assembly is one', () => {
  expect(
    namesTemporaryAssembly(SESSION, {
      trackId: 'read-vs-ref',
      type: 'SyntenyTrack',
      assemblyNames: ['hg38', 'der_chr3_1'],
    }),
  ).toBe(true)
})

test('a session holding no temporary assembly never reports', () => {
  expect(namesTemporaryAssembly({ temporaryAssemblies: [] }, SEGMENTS)).toBe(
    false,
  )
  expect(namesTemporaryAssembly({}, SEGMENTS)).toBe(false)
})

// `some` is false of nothing, so a config naming no assembly needs no guard of
// its own — unlike the sweep, where `every` was true of nothing and an
// assembly-less config would have been swept by any route that reached it.
test('a track naming no assembly is not one', () => {
  expect(
    namesTemporaryAssembly(SESSION, { trackId: 'bare', type: 'FeatureTrack' }),
  ).toBe(false)
  expect(
    namesTemporaryAssembly(SESSION, {
      trackId: 'empty',
      type: 'FeatureTrack',
      assemblyNames: [],
    }),
  ).toBe(false)
})

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
