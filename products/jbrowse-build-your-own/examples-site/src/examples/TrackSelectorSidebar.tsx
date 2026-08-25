import { Suspense, useState, useSyncExternalStore } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// A track selector: categories, a filter box, and a checkbox per track.
//
// The previous page drives the view from a toolbar whose track list is an array
// written beside it. That is fine for three tracks and wrong for thirty, and it
// is wrong the moment a track arrives that your source file did not know about.
// So this one builds its list from `session.tracks` -- every track config the
// session holds -- and groups it on the `category` slot, which is the same slot
// JBrowse's own hierarchical selector nests on.
//
// The "Add a variant track" button is the payoff: it puts a config into the
// session and nothing in this selector is told. The new category appears
// because the list is derived rather than declared.
//
// Self-contained, like every page here: nothing below is imported from the rest
// of this site, so you can copy the file and run it.

const hg38 = {
  name: 'hg38',
  uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
  refNameAliases: {
    uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
  },
}

// `category` is a `stringArray` on every track config, and it is a path rather
// than a label: JBrowse's own selector reads `['RNA-seq', 'Brain']` as a folder
// inside a folder. This selector is one level deep and takes the first entry,
// which is the honest simplification -- say so rather than pretending a
// one-level list is the whole slot.
const catalogueTracks = [
  {
    type: 'QuantitativeTrack',
    trackId: 'hg38_phylop',
    name: 'phyloP conservation',
    category: ['Signal'],
    assemblyNames: ['hg38'],
    adapter: {
      type: 'BigWigAdapter',
      uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
    },
    displayDefaults: {
      defaultRendering: 'xyplot',
      height: 80,
      color: '#3a7ca5',
    },
  },
  {
    type: 'QuantitativeTrack',
    trackId: 'hg38_gnomad_genome_coverage',
    name: 'gnomAD genome coverage',
    category: ['Signal'],
    assemblyNames: ['hg38'],
    adapter: {
      type: 'BigWigAdapter',
      uri: 'https://hgdownload.soe.ucsc.edu/gbdb/hg38/gnomAD/coverage/v3-genome/gnomad.coverage.mean.bw',
    },
    displayDefaults: { defaultRendering: 'xyplot', height: 80 },
  },
  {
    type: 'QuantitativeTrack',
    trackId: 'hg38_gnomad_exome_coverage',
    name: 'gnomAD exome coverage',
    category: ['Signal'],
    assemblyNames: ['hg38'],
    adapter: {
      type: 'BigWigAdapter',
      uri: 'https://hgdownload.soe.ucsc.edu/gbdb/hg38/gnomAD/coverage/v4-exome/gnomad.coverage.mean.bw',
    },
    displayDefaults: { defaultRendering: 'xyplot', height: 80 },
  },
  {
    type: 'FeatureTrack',
    trackId: 'hg38_genes',
    name: 'RefSeq curated genes',
    category: ['Annotation'],
    assemblyNames: ['hg38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
      csi: true,
    },
    displayDefaults: { height: 120 },
  },
  {
    type: 'FeatureTrack',
    trackId: 'hg38_segmental_dups',
    name: 'Segmental duplications',
    category: ['Annotation'],
    assemblyNames: ['hg38'],
    adapter: {
      type: 'BedTabixAdapter',
      uri: 'https://jbrowse.org/ucsc/hg38/genomicSuperDups.bed.gz',
      csi: true,
    },
    displayDefaults: { height: 100 },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'na12878_exome',
    name: 'NA12878 exome reads',
    category: ['Alignments'],
    assemblyNames: ['hg38'],
    adapter: {
      type: 'CramAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
    },
    displayDefaults: { height: 150 },
  },
  // No category at all, which is the common case in a real config and the one a
  // selector has to have an answer for. It lands under `UNFILED` below.
  {
    type: 'VariantTrack',
    trackId: 'thousand_genomes_snvindels',
    name: '1000 Genomes variants',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'VcfTabixAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz',
    },
    displayDefaults: { height: 80 },
  },
]

// Not in `catalogueTracks`: the button below adds it at runtime, and the
// selector shows it without being told.
const laterTrack = {
  type: 'VariantTrack',
  trackId: 'thousand_genomes_sv',
  name: 'Structural variants',
  category: ['Variants'],
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20210124.SV_Illumina_Integration/1KGP_3202.gatksv_svtools_novelins.freeze_V3.wAF.vcf.gz',
  },
  displayDefaults: { height: 90 },
}

function makeView() {
  const state = createViewState({
    assembly: hg38,
    tracks: catalogueTracks,
    init: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ['hg38_phylop', 'hg38_genes'],
    },
  })
  const { view } = state.session
  // see the Pan and zoom example: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
  view.setScrollZoom(true)
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']
type BrowserSession = ReturnType<typeof makeView>['session']

// `view.status` is the view's whole lifecycle as one value, so this switches on
// it rather than re-deriving which non-ready state it is out of `error` and
// `loadingMessage`. Two of the four states are easy to leave out and both fail
// silently: a 404 on a sequence file is `error` -- a state on the model rather
// than a throw, so there is no console error either -- and a view nothing has
// navigated yet is `noRegions`, which the older `view.ready` getter reports as
// ready, so gating on that one draws an empty box that never fills. The Loading
// and error states page draws the long form of this, and has a radio that
// breaks the assembly on purpose.
const ViewStatus = observer(function ViewStatus({
  view,
}: {
  view: BrowserView
}) {
  const { status } = view
  if (status.type === 'ready') {
    return null
  }
  return (
    <div
      role={status.type === 'error' ? 'alert' : 'status'}
      style={{ padding: '10px 12px', fontSize: '0.85rem', opacity: 0.75 }}
    >
      {status.type === 'error'
        ? `Could not load: ${status.error instanceof Error ? status.error.message : String(status.error)}`
        : status.type === 'loading'
          ? status.message
          : 'Nothing to show yet'}
    </div>
  )
})

const TrackRow = observer(function TrackRow({
  view,
  trackId,
}: {
  view: BrowserView
  trackId: string
}) {
  // `view.getTrack(id)`, not a scan of `view.tracks` comparing
  // `configuration.trackId` by hand: the view keeps a map for exactly this. The
  // guard stays -- a ready `view.status` says the view can draw, not that your
  // track is instantiated yet.
  const track = view.getTrack(trackId)
  if (!track) {
    return null
  }
  const display = track.activeDisplay
  const { RenderingComponent } = display
  // `TrackOverlaySlot`, not a plain sized div. A display draws floating chrome
  // of its own -- a colour key, a corner control, the loading and error states
  // -- and `contain: strict` seals that into its own stacking context, where
  // nothing you paint over the stack can be out-z-indexed. The slot is the node
  // it portals into, mounted beside the sandbox, and it is what JBrowse's own
  // track container mounts. See the Track settings page.
  return (
    <TrackOverlaySlot zIndex={3} style={{ height: display.height }}>
      <div style={{ position: 'absolute', inset: 0, contain: 'strict' }}>
        <Suspense fallback={null}>
          <RenderingComponent
            model={display}
            onHorizontalScroll={view.horizontalScroll}
          />
        </Suspense>
      </div>
    </TrackOverlaySlot>
  )
})

// Where a track with no `category` goes. Every real config has some.
const UNFILED = 'Uncategorized'

interface CatalogueEntry {
  trackId: string
  name: string
  category: string
}

/**
 * The catalogue, read out of the session instead of written beside the UI.
 *
 * `session.tracks` is every track config the session knows: the ones you passed
 * to `createViewState`, plus anything added since. It is a list of *config
 * models*, not of instantiated tracks -- `view.tracks` is that, and it holds
 * only what is currently on screen. Confusing the two is the one mistake worth
 * naming here, because both are arrays of things called tracks and only one of
 * them answers "what could I show".
 *
 * `readConfObject(conf, slot)`, not `getConf`: these are raw configuration
 * models with no `.configuration` of their own, and `getConf` exists for models
 * that *contain* one. `name` falls back to the id, which is what the config
 * schema itself does when a track declares no name.
 */
function catalogueEntries(session: BrowserSession): CatalogueEntry[] {
  return session.tracks.map(conf => {
    const path: string[] = readConfObject(conf, 'category')
    const trackId: string = readConfObject(conf, 'trackId')
    const name: string = readConfObject(conf, 'name')
    return {
      trackId,
      name: name || trackId,
      category: path[0] ?? UNFILED,
    }
  })
}

/**
 * Group in first-appearance order, which means the config file's order. Sorting
 * the categories alphabetically is the obvious next line and is worth not
 * writing: whoever wrote the config put the important tracks at the top, and an
 * alphabetical selector throws that away for a property nobody asked for.
 */
function byCategory(entries: CatalogueEntry[]) {
  const groups = new Map<string, CatalogueEntry[]>()
  for (const entry of entries) {
    const existing = groups.get(entry.category)
    if (existing) {
      existing.push(entry)
    } else {
      groups.set(entry.category, [entry])
    }
  }
  return [...groups]
}

// The box `usePanZoom`'s handlers go on -- see the Pan and zoom page for what
// each property is doing, and for the one the hook writes itself.
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  cursor: 'grab',
}

const checkboxRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '1px 0',
  cursor: 'pointer',
  lineHeight: 1.3,
}

/**
 * The selector.
 *
 * Three things it does NOT keep in React state, and each would be a bug:
 *
 * - **which tracks are on.** `view.tracks` is that, so the checkbox reads it
 *   back. A `useState` beside it goes stale the first time anything else shows
 *   a track: a bookmark that arrives with its own list, a restored session, a
 *   second panel in your app.
 * - **the catalogue.** `session.tracks` is observable, so the button at the
 *   bottom needs no callback into this component. Snapshotting it into
 *   `useState` on mount is the version that looks like it works.
 * - **the groups.** Derived from the two above on every render, which is what
 *   `observer` makes cheap enough to stop thinking about.
 *
 * The filter *is* state, because it is this component's own.
 */
const TrackSelector = observer(function TrackSelector({
  view,
  session,
}: {
  view: BrowserView
  session: BrowserSession
}) {
  const [filter, setFilter] = useState('')
  const needle = filter.trim().toLowerCase()
  const onScreen = new Set(view.tracks.map(t => t.configuration.trackId))
  const matching = catalogueEntries(session).filter(
    e =>
      e.name.toLowerCase().includes(needle) ||
      e.category.toLowerCase().includes(needle),
  )
  const groups = byCategory(matching)
  const alreadyAdded = session.tracks.some(
    conf => readConfObject(conf, 'trackId') === laterTrack.trackId,
  )

  return (
    <div
      style={{
        width: 220,
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 10,
        borderRight: '1px solid',
        borderColor: 'color-mix(in srgb, currentColor 25%, transparent)',
        fontSize: '0.8rem',
        overflow: 'auto',
      }}
    >
      <input
        aria-label="Filter tracks"
        placeholder="Filter tracks"
        value={filter}
        style={{
          font: 'inherit',
          padding: '3px 5px',
          width: '100%',
        }}
        onChange={event => {
          setFilter(event.target.value)
        }}
      />

      {groups.length === 0 ? (
        <div style={{ opacity: 0.7 }}>No track matches “{filter}”.</div>
      ) : null}

      {groups.map(([category, entries]) => (
        <div key={category}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              opacity: 0.65,
              paddingBottom: 2,
            }}
          >
            {category}
          </div>
          {entries.map(({ trackId, name }) => (
            <label key={trackId} style={checkboxRow}>
              <input
                type="checkbox"
                checked={onScreen.has(trackId)}
                onChange={() => {
                  if (onScreen.has(trackId)) {
                    view.hideTrack(trackId)
                  } else {
                    view.showTrack(trackId)
                  }
                }}
              />
              {name}
            </label>
          ))}
        </div>
      ))}

      {/* `addSessionTrackConf`, not `addTrackConf`: the latter routes an
       * admin's track into the shared config and everyone else's into the
       * session, which is two destinations behind one name and the wrong one
       * to reach for when you mean "add it for this visitor". The selector
       * above re-renders because `session.tracks` moved, not because anything
       * here called it. */}
      <button
        type="button"
        disabled={alreadyAdded}
        style={{ font: 'inherit', marginTop: 'auto', cursor: 'pointer' }}
        onClick={() => {
          session.addSessionTrackConf(laterTrack)
        }}
      >
        {alreadyAdded ? 'Variant track added' : 'Add a variant track'}
      </button>
    </div>
  )
})

/**
 * The column, drawn in catalogue order rather than in `view.tracks` order.
 *
 * `showTrack` **appends**, so `view.tracks` is in the order the boxes were
 * ticked. Mapping it straight out gives a column that reshuffles as the user
 * clicks, and the reads landing above the genes because that is the order
 * somebody happened to tick them in is not a bug anyone reports -- it just
 * reads as a browser that cannot keep still.
 *
 * So the order comes from the catalogue and `TrackRow` skips what is not
 * showing. Whichever order you want, decide it here: this is the only place
 * that knows.
 *
 * **The catalogue is `session.tracks`, not the array at the top of this file.**
 * Ordering off that array instead reads identically until something adds a
 * track at runtime, at which point the new track ticks on in the selector and
 * draws nothing, because the loop placing rows has never heard of it. Nothing
 * errors and the checkbox looks right. It cost this page a debugging session,
 * and it is the same mistake the selector avoids one component up.
 *
 * A session track sorts ahead of the config ones, which is `session.tracks`'
 * own order rather than a choice made here -- so the added track arrives at the
 * top of both the sidebar and the column, and the two agree because they read
 * the same list.
 */
const TrackColumn = observer(function TrackColumn({
  view,
  session,
}: {
  view: BrowserView
  session: BrowserSession
}) {
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  return (
    <div
      ref={ref}
      {...containerProps}
      // `flex: 1, minWidth: 0` because the sidebar beside it is fixed width and
      // this half takes the rest; without the minWidth a flex item refuses to
      // shrink below its content
      style={{ ...viewport, flex: 1, minWidth: 0 }}
    >
      {view.status.type === 'ready' ? (
        catalogueEntries(session).map(({ trackId }) => (
          <TrackRow key={trackId} view={view} trackId={trackId} />
        ))
      ) : (
        <ViewStatus view={view} />
      )}
    </div>
  )
})

// A display paints no background of its own -- its labels are drawn straight
// onto whatever is behind them, so light-theme text on a dark page is near-black
// on near-black. This is the page's own answer to "which mode am I in".
function readSiteMode(): 'light' | 'dark' {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') {
    return chosen
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

// The two places that answer can change from. The site's toggle writes an
// attribute on <html> and the OS preference arrives as a media query, and
// either can move without the other, so both are watched.
function watchSiteMode(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    media.removeEventListener('change', onChange)
  }
}

/**
 * Follow whatever the page around this demo is themed as. All of this is the
 * *host's* half, and yours will look nothing like it -- swap it for however
 * your app already knows it is in dark mode.
 *
 * `useSyncExternalStore`, not `useState` + `useEffect`: the mode lives outside
 * React, so this reads it *during* render rather than publishing one value and
 * correcting it a paint later. The third argument is the server snapshot, for
 * a reader pasting this into a framework that prerenders.
 *
 * JBrowse's half is one mount, `SessionPaletteProvider` below. It writes the
 * config slot that *both* halves of the rendering derive from -- the palette
 * React draws with, and the theme shipped to the worker that bakes feature
 * labels into the image. `PaletteProvider` on its own is the near miss: it
 * colours React and leaves those baked labels in the old mode.
 */
function useSiteMode() {
  return useSyncExternalStore(
    watchSiteMode,
    readSiteMode,
    () => 'light' as const,
  )
}

const TrackSelectorSidebar = observer(function TrackSelectorSidebar() {
  const { view, session } = useCreateOnce(makeView)
  const mode = useSiteMode()

  return (
    <SessionPaletteProvider session={session} mode={mode}>
      <DisplayUIProvider>
        {/* minHeight, not height: the sidebar is taller than two tracks and
         * shorter than seven, so the row has to be able to grow past it. A
         * fixed height would either clip the column or leave a gap under it
         * depending on how many boxes are ticked. */}
        <div style={{ display: 'flex', minHeight: 330 }}>
          <TrackSelector view={view} session={session} />
          <TrackColumn view={view} session={session} />
        </div>
      </DisplayUIProvider>
    </SessionPaletteProvider>
  )
})

export default TrackSelectorSidebar
