// Every motion tour, assembled from scripts/videos/. The specs themselves live
// one file per topic there; this file is the list, the paste-config pairing and
// the live-session links.
//
// WHAT A TOUR IS FOR. A tutorial page is a sequence of states, and its figures
// are those states. What no figure carries is how a reader gets from one to the
// next: the menu path, the dialog, the field a locus is typed into. A tour
// carries exactly that, so every tutorial gets one and it opens from a starting
// point the reader can recognise — usually the session with the data already
// loaded, and where getting the data in IS the page's difficulty (Open track,
// a pasted config, a desktop file dialog), that route is the tour.
//
// It does not replace the stills. A figure is searchable, diffable, annotatable
// and readable at a glance, and none of that survives being turned into a video;
// the film carries how the frame was reached, the figure carries what is in it.
//
// The sessions come from the spec modules rather than being written again here.
// A tour whose track config had drifted from the figures' would document a route
// through an app the rest of the page is not showing.
import { liveHref } from '../src/lib/code-base.ts'
import { HPRC_SEGMENTS_TRACK_JSON } from './specs/graph-hprc.ts'
import { dog10kVideos } from './videos/dog10k.ts'
import { pangenomeVideos } from './videos/pangenome.ts'
import { proteinVideos } from './videos/proteins.ts'
import { tcgaVideos } from './videos/tcga.ts'

import type { VideoSpec } from './video-spec-types.ts'

export type { VideoSpec, VideoStep } from './video-spec-types.ts'

export const videoSpecs: VideoSpec[] = [
  ...pangenomeVideos,
  ...proteinVideos,
  ...dog10kVideos,
  ...tcgaVideos,
]

// The track configs a tour TYPES into the app, paired with the page that prints
// them, for `check-paste-configs`.
//
// A tour that films a config being pasted documents the page only while the two
// texts are one text, and nothing about either makes them so: the tour's is a
// template literal in a spec module and the page's is a fence in markdown. A
// reworded `name`, a rehosted `uri`, one slot added to the block a reader
// copies — any of those moves one copy and leaves the other filming a config
// the page no longer prints, and the film is the half nobody re-reads.
//
// A tour reading its config through ECOLI_DEMO_BASE would need the check to
// know that; none does yet, and the check says so rather than guessing.
export const pastedTrackConfigs = [
  {
    video: 'pangenome/hprc_end_to_end',
    doc: 'tutorials/pangenome_hprc.md',
    json: HPRC_SEGMENTS_TRACK_JSON,
  },
]

// video name -> the live session the tour was filmed in, so a reader who has
// just watched the route taken can take it themselves.
//
// The same treatment a figure gets (screenshotLiveUrls), and for the stronger
// reason: a still shows a state, and a film shows a route, which is only worth
// watching if the reader can then walk it. Every url here is the spec's own, so
// the link cannot drift from what was filmed.
export const videoLiveUrls: Record<string, string> = Object.fromEntries(
  videoSpecs.map(spec => [spec.name, liveHref(spec.url)]),
)
