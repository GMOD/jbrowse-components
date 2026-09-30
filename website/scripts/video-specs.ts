// Every motion tour, assembled from scripts/videos/. The specs themselves live
// one file per topic there; this file is the list, the paste-config pairing and
// the live-session links.
//
// WHAT A TOUR IS FOR. A tutorial page is a sequence of states, and its figures
// are those states. What no figure carries is how a reader gets from one to the
// next: the menu path, the dialog, the field a locus is typed into. A tour
// carries exactly that, so a page with a route worth watching gets one — not
// every page, which is the rule in website/CLAUDE.md. It opens from a starting
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
import { GENE_CHANNEL_SPEC_JSON } from './specs/features.ts'
import { configVideos } from './videos/config.ts'
import { dog10kVideos } from './videos/dog10k.ts'
import { epigenomicsVideos } from './videos/epigenomics.ts'
import { genomesBasicsVideos } from './videos/genomes_basics.ts'
import { hicVideos } from './videos/hic.ts'
import { methylationVideos } from './videos/methylation.ts'
import { pangenomeVideos } from './videos/pangenome.ts'
import { proteinVideos } from './videos/proteins.ts'
import { repeatVideos } from './videos/repeats.ts'
import { svVideos } from './videos/sv.ts'
import { syntenyVideos } from './videos/synteny.ts'
import { tcgaVideos } from './videos/tcga.ts'
import { uiVideos } from './videos/ui.ts'
import { variantVideos } from './videos/variants.ts'

import type { VideoSpec } from './video-spec-types.ts'

export type { VideoSpec, VideoStep } from './video-spec-types.ts'

export const videoSpecs: VideoSpec[] = [
  ...pangenomeVideos,
  ...proteinVideos,
  ...dog10kVideos,
  ...tcgaVideos,
  ...methylationVideos,
  ...syntenyVideos,
  ...svVideos,
  ...uiVideos,
  ...variantVideos,
  ...repeatVideos,
  ...hicVideos,
  ...epigenomicsVideos,
  ...configVideos,
  ...genomesBasicsVideos,
]

// Clips this generator cannot film, because what they show is not a
// jbrowse-web page under puppeteer.
//
// The MCP screencast is JBrowse Desktop being driven over its MCP socket by a
// real Claude Code session, captured through the app's own screenshot tool: no
// url to load, no steps to run, and no live session to hand a reader, since the
// session is one an agent built during the take. So a VideoSpec cannot describe
// it and `pnpm video` cannot reproduce it.
//
// What it still needs from this file is a name check-video-specs will accept on
// an embed, and its frame, which remark-video reserves the player's box from.
// Everything else a tour gets — the live link, the caption track, the re-film —
// it does without.
//
// Add one only where the same is true. A clip that CAN be filmed by the
// generator belongs in videoSpecs, where a stale one is one `--filter` away
// from being current again.
export interface ExternalClip {
  name: string
  width: number
  height: number
  description: string
}

export const externalClips: ExternalClip[] = [
  {
    name: 'mcp/agent_geo_ratio_take1',
    width: 1920,
    height: 1028,
    description:
      'Claude Code over the Desktop MCP socket with the terminal in frame and no shell: four GEO ATAC-seq bigWigs streamed into hg38 at CDKN1A, a deepTools-style log2 nutlin-over-vehicle track derived in the app, then CDKN1A laid beside GAPDH and a gene desert to test whether the gain is a normalization artifact',
  },
  {
    name: 'mcp/agent_synteny_take1',
    width: 1920,
    height: 1222,
    description:
      'Claude Code over the Desktop MCP socket with a shell: two fly genomes with no published alignment, aligned with minimap2, shown as synteny and dotplot, the largest inversion found and navigated to',
  },
  {
    name: 'mcp/agent_derivative_take1',
    width: 1920,
    height: 1222,
    description:
      'Claude Code over the Desktop MCP socket with a shell: a three-chromosome somatic rearrangement found in a callset, its allele rebuilt from the tumor reads, loaded as an assembly and audited at every junction',
  },
]

// The configs a tour TYPES into the app that it cannot read off the page,
// paired with the page that prints them, for `check-paste-configs`. A tour
// pasting a whole track config reads the page's fence (`pageFenceText`), so
// only a fragment lands here: the page prints it in an untagged fence with no
// trackId to find it by.
//
// A tour documents the page only while the two texts are one text: a reworded
// value moves one copy and leaves the other filming a config the page no
// longer prints, and the film is the half nobody re-reads.
export const pastedTrackConfigs = [
  {
    video: 'ui/gene_track_channel_spec',
    doc: 'user_guides/gene_track.md',
    json: GENE_CHANNEL_SPEC_JSON,
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
