import {
  addTrackFromWidget,
  containerDisplaysAssembly,
} from './addTrackFromWidget.ts'

import type { AssemblyNameResolver } from './tracks.ts'

// volvox declares `vvx` as an alias, so a view opened on one and a track
// configured against the other are one assembly. Every "does this container
// display this track" test has to say so, or the track is added and then
// reported undisplayable against the assembly on screen.
const ALIASES: AssemblyNameResolver = {
  getCanonicalAssemblyName: name =>
    name === 'vvx' || name === 'volvox' ? 'volvox' : undefined,
}

test('a container displays a track naming its assembly by an alias', () => {
  expect(
    containerDisplaysAssembly({ assemblyNames: ['volvox'] }, ['vvx'], ALIASES),
  ).toBe(true)
})

test('a container does not display a track on another assembly', () => {
  expect(
    containerDisplaysAssembly({ assemblyNames: ['volvox'] }, ['hg38'], ALIASES),
  ).toBe(false)
})

function fakeSession() {
  const notifications: string[] = []
  return {
    notifications,
    session: {
      rpcManager: {},
      configuration: {},
      assemblyManager: ALIASES,
      publishTrackConf: (conf: { trackId: string }) => conf,
      notify: (message: string) => {
        notifications.push(message)
      },
      notifyError: () => {},
    },
  }
}

// The user-visible half: the track is published, the view it was added from is
// on the same assembly under its other name, and nothing appears — with a
// snackbar naming the assembly the user is looking at as one this view does not
// have open.
test('addTrackFromWidget shows a track whose assembly the container names by an alias', () => {
  const { notifications, session } = fakeSession()
  const shown: string[] = []

  addTrackFromWidget({
    model: {
      trackContainer: {
        assemblyNames: ['volvox'],
        showTrack: (trackId: string) => shown.push(trackId),
      },
      clearData: () => {},
    } as never,
    session: session as never,
    conf: { trackId: 't1', type: 'FeatureTrack', assemblyNames: ['vvx'] },
  })

  expect(shown).toEqual(['t1'])
  expect(notifications).toEqual([])
})
