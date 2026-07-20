import {
  DEMO_CONFIG,
  HPYLORI_26695_SEQ_ADAPTER,
  VOLVOX,
  hpyloriUrl,
  lgvSession,
  menuCascade,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The volvox microarray BigWig, absolute-hosted so it resolves both in the local
// generator and in the live-link session (session tracks don't inherit the
// config's baseUri). Reused across the "all plot types" comparison figure.
const MICROARRAY_BW_ADAPTER = {
  type: 'BigWigAdapter',
  bigWigLocation: {
    uri: 'https://jbrowse.org/code/jb2/latest/test_data/volvox/volvox_microarray.bw',
    locationType: 'UriLocation',
  },
}

// One QuantitativeTrack per rendering style, all wrapping the same BigWig, so a
// single figure shows every plot type rendered live side by side. The rendering
// style itself is applied via the flat `defaultRendering` key on the view's
// track reference (routes into the display's configOverrides).
const wigModeTrack = (rendering: string, name: string) => ({
  type: 'QuantitativeTrack',
  trackId: `wiggle_mode_${rendering}`,
  name,
  assemblyNames: ['volvox'],
  adapter: MICROARRAY_BW_ADAPTER,
})

export const bigwigSpecs: ScreenshotSpec[] = [
  // reviewer: the plain line-render figure was boring on its own, and a single
  // "plot type" menu screenshot doesn't show what each mode looks like. Instead
  // render the same BigWig in every plot type at once — one compact track per
  // style — so the figure teaches all the rendering options live, side by side.
  {
    mode: 'url',
    name: 'bigwig_line',
    url: sessionSpec(VOLVOX, {
      sessionTracks: [
        wigModeTrack('xyplot', 'XY plot'),
        wigModeTrack('density', 'Density'),
        wigModeTrack('line', 'Line (step)'),
        wigModeTrack('linecenter', 'Line (interpolated)'),
        wigModeTrack('scatter', 'Scatter'),
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: [
            {
              trackId: 'wiggle_mode_xyplot',
              defaultRendering: 'xyplot',
              height: 90,
            },
            {
              trackId: 'wiggle_mode_density',
              defaultRendering: 'density',
              height: 60,
            },
            {
              trackId: 'wiggle_mode_line',
              defaultRendering: 'line',
              height: 90,
            },
            {
              trackId: 'wiggle_mode_linecenter',
              defaultRendering: 'linecenter',
              height: 90,
            },
            {
              trackId: 'wiggle_mode_scatter',
              defaultRendering: 'scatter',
              height: 90,
            },
          ],
        },
      ],
    }),
    readyText: 'Scatter',
    readyTimeout: 60000,
    settleMs: 6000,
    viewportHeight: 640,
  },

  // GC content / GC skew computed on the fly from the reference sequence — the
  // tracks the reference sequence track's "Add GC content track" action builds.
  // Shown whole-genome on H. pylori 26695 (a compact 1.67 Mbp bacterial genome)
  // so the GC skew resolves real replication biology: the (G−C)/(G+C) balance
  // stays predominantly one sign along each replichore and flips at the origin
  // and terminus of replication, drawing the classic two-arm skew profile. Two
  // session GCContentTracks wrap the assembly's sequence (absolute fasta url —
  // session tracks don't inherit the config's baseUri): one in `content` mode
  // (G+C fraction) and one in `skew` mode with a wide overlapping smoothing
  // window, both smoothing the genome-scale curve.
  {
    mode: 'url',
    name: 'gc_content',
    url: hpyloriUrl({
      sessionTracks: [
        {
          type: 'GCContentTrack',
          trackId: 'gc_content_hpylori',
          name: 'GC content',
          assemblyNames: ['hpylori_26695'],
          adapter: {
            type: 'GCContentAdapter',
            sequenceAdapter: HPYLORI_26695_SEQ_ADAPTER,
          },
          displays: [
            {
              type: 'LinearGCContentTrackDisplay',
              displayId: 'gc_content_hpylori-display',
              gcMode: 'content',
              windowSize: 2000,
              windowDelta: 2000,
            },
          ],
        },
        {
          type: 'GCContentTrack',
          trackId: 'gc_skew_hpylori',
          name: 'GC skew',
          assemblyNames: ['hpylori_26695'],
          adapter: {
            type: 'GCContentAdapter',
            sequenceAdapter: HPYLORI_26695_SEQ_ADAPTER,
          },
          displays: [
            {
              type: 'LinearGCContentTrackDisplay',
              displayId: 'gc_skew_hpylori-display',
              gcMode: 'skew',
              windowSize: 20000,
              windowDelta: 2000,
              // taller so the two-arm skew and its zero-crossings at the origin
              // and terminus read clearly across the whole genome
              height: 160,
            },
          ],
        },
        // The two replication landmarks the GC skew reveals, as an actual
        // feature track (not just highlight bands). oriC is anchored on the
        // annotated dnaA gene (NC_018939.1:1,607,647-1,609,020, the chromosomal
        // replication initiator that binds the origin) — a known landmark that
        // coincides with the cumulative-skew minimum; the terminus sits at the
        // skew maximum. Widened to ~20kb region markers so they're visible at
        // whole-genome zoom. FromConfigAdapter keeps the features inline, so the
        // track needs no hosted file and travels with the live-link session.
        {
          type: 'FeatureTrack',
          trackId: 'hpylori_repl_origin',
          name: 'Replication origin / terminus (from GC skew)',
          assemblyNames: ['hpylori_26695'],
          adapter: {
            type: 'FromConfigAdapter',
            features: [
              {
                refName: 'NC_018939.1',
                uniqueId: 'oriC',
                start: 1_598_000,
                end: 1_618_000,
                name: 'oriC (dnaA)',
                color: '#1e8484',
              },
              {
                refName: 'NC_018939.1',
                uniqueId: 'terminus',
                start: 804_000,
                end: 824_000,
                name: 'terminus',
                color: '#d62828',
              },
            ],
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hpylori_26695',
          loc: 'NC_018939.1',
          // interactive chip on each highlight band uses the link icon (chips are
          // opt-in; default off draws a bare band)
          showHighlightChips: true,
          // Faint vertical guides at the two replication landmarks the origin
          // track names above, so the eye connects each marker to the GC-skew
          // sign transition far below it (labels live on the feature track, not
          // here, to avoid double-labeling).
          highlight: [
            {
              refName: 'NC_018939.1',
              start: 1_598_000,
              end: 1_618_000,
              assemblyName: 'hpylori_26695',
              color: 'rgba(30,132,132,0.14)',
            },
            {
              refName: 'NC_018939.1',
              start: 804_000,
              end: 824_000,
              assemblyName: 'hpylori_26695',
              color: 'rgba(214,40,40,0.12)',
            },
          ],
          tracks: [
            {
              trackId: 'hpylori_repl_origin',
              type: 'LinearBasicDisplay',
              height: 50,
              color: "jexl:get(feature,'color')",
            },
            'gc_content_hpylori',
            'gc_skew_hpylori',
          ],
        },
      ],
    }),
    readyText: 'GC content',
    readyTimeout: 60000,
    settleMs: 8000,
    // origin track(50) + content(~100) + taller skew(160) + headers/ruler/
    // overview; crop off the empty viewport below the three tracks
    crop: { x: 0, y: 0, width: 1500, height: 640 },
    // Name the two-arm skew profile: the leading replichore (origin→terminus)
    // runs mostly positive (blue), the lagging one mostly negative (red), the
    // sign flipping at the two replication landmarks. Placed over each arm of
    // the GC skew track (bottom).
    annotations: [
      {
        type: 'text',
        text: 'Mostly positive skew (leading strand)',
        x: 150,
        y: 430,
        maxWidth: 260,
      },
      {
        type: 'text',
        text: 'Mostly negative skew (lagging strand)',
        x: 930,
        y: 555,
        maxWidth: 260,
      },
    ],
  },

  // Whole-genome coverage profile from a single BigWig (COLO829 tumor MinION
  // coverage), each chromosome a separate region (no `loc` →
  // showAllRegionsInAssembly), localsd ±3sd autoscale so copy-number gains/losses
  // read as elevated/depressed signal. Rebuilt from the old server-side share
  // link as a self-contained sessionSpec; cropped to the single short track.
  {
    mode: 'url',
    name: 'bigwig/whole_genome_coverage',
    // start at a single chromosome so the figure can walk through the setup
    // (show how to build this view). Stage 1 opens the View → Show...
    // menu with "Show all regions in assembly" boxed; stage 2 is the result.
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr10',
      tracks: [
        {
          trackId: 'colo_tumor',
          type: 'LinearWiggleDisplay',
          autoscale: 'localsd',
          numStdDev: 3,
          // scatter rendering reads copy-number gains/losses better than
          // the filled XY plot across the whole genome
          defaultRendering: 'scatter',
          // finer binning (basesPerSpan = bpPerPx/resolution) so the
          // whole-genome scatter resolves copy-number structure
          resolution: 5,
          // plot the per-bin average rather than the default whiskers
          // (min/max/avg) — at whole-genome zoom the avg score reads the
          // copy-number level cleanly without the noise band
          summaryScoreMode: 'avg',
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 60000,
    settleMs: 15000,
    // tall enough to capture the full open View → Show... submenu in stage 1
    // (the menu was cut off at the old 420px height)
    crop: { x: 0, y: 0, width: 1500, height: 560 },
    stages: [
      {
        // top frame: single chromosome, View → Show... submenu open with
        // "Show all regions in assembly" boxed — the one click that zooms the
        // view out to the whole genome
        actions: [
          { type: 'click', selector: '[data-testid="view_menu_icon"]' },
          ...menuCascade(['Show...', 'Show all regions in assembly']),
        ],
        annotations: [
          // ring the view (hamburger) menu icon that opens this menu
          {
            type: 'circle',
            anchor: { selector: '[data-testid="view_menu_icon"]' },
          },
          // box the "Show..." parent item plus the sub-item it reveals so the
          // whole menu path reads at a glance
          { type: 'box', anchor: { text: 'Show...' } },
          { type: 'box', anchor: { text: 'Show all regions in assembly' } },
        ],
      },
      {
        // bottom frame: after the click the view spans every chromosome and the
        // scatter coverage resolves whole-genome copy-number structure. Wait on
        // the wiggle canvas's paint-complete testid (canvasDrawn -> -done)
        // instead of a fixed delay so the frame isn't captured blank (reviewer:
        // the old 12s delay sometimes fired before the whole-genome render).
        actions: [
          { type: 'click', text: 'Show all regions in assembly' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="wiggle-display-done"]',
          },
          { type: 'delay', ms: 2000 },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Multi-quantitative (MultiWig) screenshots
  // ────────────────────────────────────────────────────────────────────────

  // MultiWig track menu showing the plot type submenu.
  {
    mode: 'url',
    name: 'multiwig/multi_renderer_types',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_microarray_multi'],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Plot type', 'Multi-row', 'XY plot']),
    ],
    annotations: [{ type: 'box', anchor: { text: 'Plot type' } }],
  },

  // multiquantitative_track.md: the track-selector selection workflow for
  // building a multi-wiggle. Two stacked frames: (1) a category's "..." menu
  // with "Add to selection" boxed, (2) after adding the category, the shopping
  // cart's "Create multi-wiggle track" item boxed.
  {
    mode: 'url',
    name: 'multiwig/trackselector',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    // smaller capture in both dimensions; narrower than default but
    // still wide enough for the category "..." menu to cascade without clipping,
    // and the "Integration test" wiggle category renders within this height
    viewportWidth: 950,
    viewportHeight: 600,
    stages: [
      {
        actions: [
          // open the track selector via the in-view header button, not the view
          // hamburger menu, which would otherwise linger open over the capture
          // (only the track menus should show)
          { type: 'click', selector: 'button[title="Open track selector"]' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="hierarchical_track_selector"]',
          },
          { type: 'delay', ms: 500 },
          // open the category's "..." track menu (stable testid on the category
          // CascadingMenuButton)
          {
            type: 'click',
            selector: '[data-testid="htsCategoryMenu-Integration test"]',
          },
          { type: 'waitForText', text: 'Add to selection' },
          { type: 'delay', ms: 400 },
        ],
        // box the menu item and put the caption over the empty LGV area to its
        // left; no arrow (arrows covered up the menu-item text)
        annotations: [
          { type: 'box', anchor: { text: 'Add to selection' } },
          {
            type: 'text',
            x: 60,
            y: 330,
            maxWidth: 300,
            text: 'Open a track category menu and click Add to selection',
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Add to selection' },
          { type: 'delay', ms: 600 },
          // the shopping cart appears once the selection is non-empty
          { type: 'click', selector: '[data-testid="hts-shopping-cart"]' },
          { type: 'waitForText', text: 'Create multi-wiggle track' },
          { type: 'delay', ms: 400 },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Create multi-wiggle track' } },
          {
            type: 'text',
            x: 60,
            y: 330,
            maxWidth: 300,
            text: 'Open the selection cart and click Create multi-wiggle track',
          },
        ],
      },
    ],
  },

  // Add track dialog showing the multi-wiggle workflow selector.
  {
    mode: 'url',
    name: 'multiwig/addtrack',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    // shorter/narrower window — the add-track form is short and the LGV pane
    // behind it is mostly empty
    viewportWidth: 1300,
    viewportHeight: 520,
    actions: [
      { type: 'click', text: 'File' },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'delay', ms: 300 },
      { type: 'click', text: 'Open track...' },
      { type: 'waitForText', text: 'Enter track data' },
      { type: 'delay', ms: 500 },
    ],
    // two-stage: top frame opens the workflow-selector dropdown with a callout
    // (on a dark pill so it reads over the form) and an arrow to it; bottom frame
    // selects "Add multi-wiggle track" and boxes the paste textbox
    stages: [
      {
        actions: [
          { type: 'click', text: 'Add a track from file or URL' },
          { type: 'waitForText', text: 'Add multi-wiggle track' },
          { type: 'delay', ms: 800 },
        ],
        annotations: [
          {
            type: 'text',
            x: 470,
            y: 310,
            text: 'This dropdown reaches other add-track workflows, e.g. multi-wiggle',
            background: 'rgba(0,0,0,0.8)',
            textColor: '#fff',
            fontSize: 22,
          },
          {
            type: 'arrow',
            from: { x: 880, y: 262 },
            anchor: { selector: '[aria-expanded="true"]' },
          },
          // box the specific target option in the open dropdown
          { type: 'box', anchor: { text: 'Add multi-wiggle track' } },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Add multi-wiggle track' },
          { type: 'waitForText', text: 'Add' },
          { type: 'delay', ms: 1200 },
        ],
        // box the paste textbox + a label just to its left with a short arrow
        // into the box (the label used to float far from the box; the
        // form hugs the right edge so the label can't sit above it without
        // clipping)
        annotations: [
          {
            type: 'box',
            anchor: { selector: 'textarea[placeholder^="Paste a list"]' },
          },
          {
            type: 'arrow',
            from: { x: 690, y: 250 },
            anchor: { selector: 'textarea[placeholder^="Paste a list"]' },
            dx: -8,
          },
          {
            type: 'text',
            x: 300,
            y: 245,
            text: 'Paste wiggle file URLs here',
            background: 'rgba(0,0,0,0.8)',
            textColor: '#fff',
            fontSize: 26,
          },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Clustering workflows
  // ────────────────────────────────────────────────────────────────────────

  // Multi-wiggle clustering, two-stage figure over the PUR copy-number panel
  // (1000 Genomes kidd-lab CNV bigWigs, 104 PUR individuals) added to
  // config_demo — a far richer dataset than the synthetic volvox wiggle
  // . Shown in multi-row density mode across a wide hg38 window
  // (chr3:162.3-163.4 Mb, reviewer-specified), a copy-number-polymorphic region,
  // so the per-individual copy-number differences drive a meaningful clustering.
  // Top frame: the "Cluster by score" dialog open (auto/manual mode, before).
  // Bottom frame: after "Run clustering", the 104 rows are reordered by signal
  // similarity. showTree:false hides the dendrogram (only the row
  // reordering matters; a tree wrongly implies phylogeny). Combines the old
  // cluster_dialog + clustered_result into one before/after.
  {
    mode: 'url',
    name: 'multiwig/cluster_dialog',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      // reviewer-specified region
      loc: 'chr3:162,275,163-163,360,944',
      tracks: [
        {
          trackId: 'pur_copynumber_1000g',
          type: 'MultiLinearWiggleDisplay',
          height: 420,
          // multi-row density renderer: one colored density
          // strip per individual; `defaultRendering` is a config slot, so
          // this flat key routes into the display's configOverrides
          defaultRendering: 'multirowdensity',
          // hide the post-clustering dendrogram — the reordered rows are
          // the point; a tree implies a phylogeny we don't mean
          showTree: false,
        },
      ],
    }),
    readyText: 'PUR',
    readySelector: '[data-testid="multi-wiggle-display-done"]',
    readyTimeout: 90000,
    viewportHeight: 620,
    settleMs: 15000,
    stages: [
      {
        // top frame: the Cluster by score dialog open, before clustering
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          // "Cluster rows by score..." now lives under a "Clustering" submenu
          { type: 'waitForText', text: 'Clustering' },
          { type: 'hover', text: 'Clustering' },
          { type: 'waitForText', text: 'Cluster rows by score...' },
          { type: 'delay', ms: 300 },
          { type: 'click', text: 'Cluster rows by score...' },
          { type: 'waitForText', text: 'Run clustering' },
          { type: 'delay', ms: 500 },
        ],
      },
      {
        // bottom frame: run clustering, then show reordered rows + dendrogram
        actions: [
          { type: 'click', text: 'Run clustering' },
          { type: 'waitForText', text: 'Run clustering', hidden: true },
          { type: 'delay', ms: 7000 },
        ],
      },
    ],
  },
]
