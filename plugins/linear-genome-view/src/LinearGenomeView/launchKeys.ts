import { defineLaunchKeys } from '@jbrowse/core/util/withLaunchInput'

import type { InitState } from './types.ts'

// The argument is `Record<keyof InitState, LaunchKeySpec>`, so a command this
// view interprets and nobody registered here is a compile error rather than a
// key that partitions as a typo.
//
// `bpPerPx`/`offsetPx` are v4's viewport spelling from before it was stored as
// a window, and `showCytobandsSetting` its cytoband toggle. None is a declared
// property, so the partition would read them as typos; the model's own
// preProcessSnapshot still converts them, so a URL or saved spec naming them
// goes on working. Share links carry all three, so they stay.
//
// #launchKeys LinearGenomeView — the URL parameters page renders this list
// rather than restating it; each of these keys has its own `&param=` section
// there, which is why no description is attached here.
export const lgvLaunchKeys = defineLaunchKeys<InitState>()(
  {
    loc: { kind: 'launch' },
    grow: { kind: 'launch' },
    showHitTrack: { kind: 'launch' },
    assembly: { kind: 'launch' },
    displayedRegionNames: { kind: 'launch' },
    tracklist: { kind: 'launch' },
    nav: { kind: 'launch' },
    tracks: { kind: 'trackEntries' },
    highlight: { kind: 'launch' },
  },
  {
    passThrough: ['bpPerPx', 'offsetPx', 'showCytobandsSetting'],
  },
)
