import { coarseStripHTML, parseLocString } from '@jbrowse/core/util'
import {
  lgvSvgLayoutOptions,
  staticLgvFrame,
  staticLgvSvg,
} from '@jbrowse/plugin-linear-genome-view'
import { staticWiggleDisplay } from '@jbrowse/plugin-wiggle/staticSvg'
import { assemblyResolver, renameRegions } from '@jbrowse/tables'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  ExportSvgDisplayOptions,
  ExportSvgOptions,
} from '@jbrowse/display-kit/types'
import type { Assembly } from '@jbrowse/launch-args'
import type { ResolvedAssembly } from '@jbrowse/tables'

/** A quantitative track as a static export draws it. */
export interface StaticWiggleTrack {
  trackId: string
  name?: string
  adapterConfig: Record<string, unknown>
  /** the track's display config, as a `displays` entry writes it */
  display?: Record<string, unknown>
}

/**
 * The view's single displayed region and its window for a locString, as
 * `navToLocString` places a view: the contig whole, the window the span asked
 * for (the contig when none). The name is the reader's text, so it resolves
 * through the assembly's aliases, and one the assembly has no contig for
 * fails.
 */
export function staticLocWindow(
  { regions, canonical }: ResolvedAssembly,
  assemblyName: string,
  loc: string,
) {
  const contigOf = (name: string) =>
    regions.find(r => canonical(r.refName) === canonical(name))
  const parsed = parseLocString(loc, name => contigOf(name) !== undefined)
  const contig = contigOf(parsed.refName)
  if (!contig) {
    throw new Error(`no contig "${parsed.refName}" in ${assemblyName}`)
  }
  const start = parsed.start ?? contig.start
  const end = parsed.end ?? contig.end
  return {
    displayedRegions: [
      {
        assemblyName,
        refName: contig.refName,
        start: contig.start,
        end: contig.end,
      },
    ],
    windowStartBp: start - contig.start,
    windowWidthBp: end - start,
  }
}

/**
 * A linear genome view of quantitative tracks as jb2export draws it, with no
 * session: the assembly resolved before the frame, the frame over the
 * locString's contig in the assembly's names, each track fetched in its
 * file's names and drawn by its display's own views, and the view's chrome
 * around them. Ids are a session's first view's, so the document is the one
 * the session export writes.
 */
export async function staticLinearSvg({
  pluginManager,
  assembly,
  loc,
  width,
  tracks,
  theme,
  opts,
}: {
  pluginManager: PluginManager
  assembly: Assembly
  loc: string
  width: number
  tracks: StaticWiggleTrack[]
  theme?: ExportSvgDisplayOptions['theme']
  opts: ExportSvgOptions
}) {
  const resolved = await assemblyResolver(pluginManager)({ ...assembly })
  const frame = staticLgvFrame({
    width,
    ...staticLocWindow(resolved, assembly.name, loc),
  })
  const { fontSize } = lgvSvgLayoutOptions(opts)
  const drawn = await Promise.all(
    tracks.map(async ({ trackId, name, adapterConfig, display }, i) => ({
      trackId,
      name: coarseStripHTML(name ?? trackId),
      ...(await staticWiggleDisplay(pluginManager, {
        adapterConfig,
        display,
        frame,
        id: `${frame.id}-${i}-0`,
        opts: { ...opts, fontSize, theme },
        renameRegions: async regions =>
          (
            await renameRegions(
              pluginManager,
              { adapterConfig, regions },
              resolved,
            )
          ).regions,
      })),
    })),
  )
  return staticLgvSvg({ view: frame, tracks: drawn, theme, opts })
}
