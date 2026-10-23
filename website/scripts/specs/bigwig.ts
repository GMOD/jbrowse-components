import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  DEMO_CONFIG,
  VOLVOX,
  cascadeBoxes,
  lgvSession,
  menuCascade,
  TRACK_SELECTOR,
  sessionSpec,
  HPYLORI_CONFIG,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Absolute URLs: session tracks don't inherit the config's baseUri.
export const HPYLORI_26695_SEQ_ADAPTER = {
  type: 'IndexedFastaAdapter',
  fastaLocation: {
    uri: 'https://jbrowse.org/demos/hpylori/hpylori_26695.fa',
    locationType: 'UriLocation',
  },
  faiLocation: {
    uri: 'https://jbrowse.org/demos/hpylori/hpylori_26695.fa.fai',
    locationType: 'UriLocation',
  },
}

const MICROARRAY_BW_ADAPTER = {
  type: 'BigWigAdapter',
  bigWigLocation: {
    uri: 'https://jbrowse.org/code/jb2/latest/test_data/volvox/volvox_microarray.bw',
    locationType: 'UriLocation',
  },
}

const wigModeTrack = (rendering: string, name: string) => ({
  type: 'QuantitativeTrack',
  trackId: `wiggle_mode_${rendering}`,
  name,
  assemblyNames: ['volvox'],
  adapter: MICROARRAY_BW_ADAPTER,
})

export const bigwigSpecs: ScreenshotSpec[] = [
  // One BigWig drawn in every plot type.
  {
    mode: 'url',
    name: 'bigwig_line',
    url: sessionSpec(VOLVOX, {
      sessionTracks: [
        wigModeTrack('xyplot', 'Bar plot'),
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
              mark: 'bar',
              height: 90,
            },
            {
              trackId: 'wiggle_mode_density',
              mark: 'span',
              height: 60,
            },
            {
              trackId: 'wiggle_mode_line',
              mark: 'line',
              height: 90,
            },
            {
              trackId: 'wiggle_mode_linecenter',
              mark: { type: 'line', interpolate: 'linear' },
              height: 90,
            },
            {
              trackId: 'wiggle_mode_scatter',
              mark: 'point',
              height: 90,
            },
          ],
        },
      ],
    }),
    readyText: 'Scatter',
    readyTimeout: 60000,
    viewportHeight: 793,
  },

  {
    mode: 'url',
    name: 'gc_content',
    url: sessionSpec(HPYLORI_CONFIG, {
      sessionTracks: [
        {
          type: 'GCContentTrack',
          trackId: 'gc_content_hpylori',
          name: 'GC content',
          assemblyNames: ['GCF_000307795.1'],
          adapter: {
            type: 'GCContentAdapter',
            sequenceAdapter: HPYLORI_26695_SEQ_ADAPTER,
            op: 'content',
            window: 2000,
            step: 2000,
          },
        },
        {
          type: 'GCContentTrack',
          trackId: 'gc_skew_hpylori',
          name: 'GC skew',
          assemblyNames: ['GCF_000307795.1'],
          adapter: {
            type: 'GCContentAdapter',
            sequenceAdapter: HPYLORI_26695_SEQ_ADAPTER,
            op: 'skew',
            window: 20000,
            step: 2000,
          },
          displays: [
            {
              type: 'LinearWiggleDisplay',
              displayId: 'gc_skew_hpylori-LinearWiggleDisplay',
              height: 160,
            },
          ],
        },
        // oriC centres on dnaA (NC_018939v1:1,607,647-1,609,020); both markers
        // span 20 kb so they show at whole-genome zoom.
        {
          type: 'FeatureTrack',
          trackId: 'hpylori_repl_origin',
          name: 'Replication origin / terminus (from GC skew)',
          assemblyNames: ['GCF_000307795.1'],
          adapter: {
            type: 'FromConfigAdapter',
            features: [
              {
                refName: 'NC_018939v1',
                uniqueId: 'oriC',
                start: 1_598_000,
                end: 1_618_000,
                name: 'oriC (dnaA)',
                color: '#1e8484',
              },
              {
                refName: 'NC_018939v1',
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
          assembly: 'GCF_000307795.1',
          loc: 'NC_018939v1',
          // unlabeled: the origin track already names both landmarks
          highlight: [
            {
              refName: 'NC_018939v1',
              start: 1_598_000,
              end: 1_618_000,
              assemblyName: 'GCF_000307795.1',
              color: 'rgba(30,132,132,0.14)',
            },
            {
              refName: 'NC_018939v1',
              start: 804_000,
              end: 824_000,
              assemblyName: 'GCF_000307795.1',
              color: 'rgba(214,40,40,0.12)',
            },
          ],
          tracks: [
            {
              trackId: 'hpylori_repl_origin',
              height: 50,
              encoding: { color: { value: "jexl:get(feature,'color')" } },
            },
            'gc_content_hpylori',
            'gc_skew_hpylori',
          ],
        },
      ],
    }),
    readyText: 'GC content',
    readyTimeout: 60000,
    crop: { x: 0, y: 0, width: 1500, height: 640 },
    annotations: [
      {
        type: 'text',
        text: 'leading strand',
        anchor: {
          trackId: 'gc_skew_hpylori',
          loc: 'NC_018939v1:166,800',
          fracY: 0.11,
        },
        maxWidth: 260,
      },
      {
        type: 'text',
        text: 'lagging strand',
        anchor: {
          trackId: 'gc_skew_hpylori',
          loc: 'NC_018939v1:1,034,100',
          fracY: 0.89,
        },
        maxWidth: 260,
      },
      {
        type: 'text',
        text: 'terminus',
        leader: true,
        anchor: {
          trackId: 'gc_skew_hpylori',
          loc: 'NC_018939v1:814,000',
          fracY: 0.45,
        },
        dx: 60,
        dy: -45,
        maxWidth: 220,
      },
      {
        type: 'text',
        text: 'origin',
        leader: true,
        anchor: {
          trackId: 'gc_skew_hpylori',
          loc: 'NC_018939v1:1,608,000',
          fracY: 0.45,
        },
        dx: -60,
        dy: -45,
        maxWidth: 220,
      },
    ],
  },

  {
    mode: 'url',
    name: 'bigwig/whole_genome_coverage',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: 'chr10',
      tracks: [
        {
          trackId: 'colo_tumor',
          mark: 'point',
          data: { resolution: 5 },
          extent: 'none',
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 180000,
    // Fits the open menu with its submenu; stage 2 sets its own, shorter height.
    viewportHeight: 680,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="view_menu_icon"]' },
          ...menuCascade(['Show...', 'Show all regions in assembly']),
          // After waitForRasterize's two frames the compositor can still show
          // the view body white behind the popover.
          { type: 'delay', ms: 1000 },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="view_menu_icon"]' },
          },
          ...cascadeBoxes(['Show...', 'Show all regions in assembly']),
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Show all regions in assembly' },
          {
            type: 'waitForSelector',
            selector: displayPainted('wiggle-display'),
          },
        ],
        viewportHeight: 340,
      },
    ],
  },

  // Needs a MultiWig: a single-source track's Plot type menu has no layout
  // groups.
  {
    mode: 'url',
    name: 'multiwig/multi_renderer_types',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_microarray_multi'],
    }),
    readyText: 'ctgA',
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      ...menuCascade(['Plot type', 'Multi-row', 'Bar plot']),
    ],
    annotations: [{ type: 'box', anchor: { text: 'Plot type' } }],
  },

  {
    mode: 'url',
    name: 'multiwig/trackselector',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracklist: true,
    }),
    readyText: 'ctgA',
    readySelector: TRACK_SELECTOR,
    // any narrower and the category menu clips as it cascades
    viewportWidth: 950,
    viewportHeight: 600,
    stages: [
      {
        actions: [
          {
            type: 'click',
            selector: '[data-testid="htsCategoryMenu-Integration test"]',
          },
          { type: 'waitForText', text: 'Add to selection' },
        ],
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
          { type: 'click', selector: '[data-testid="hts-shopping-cart"]' },
          { type: 'waitForText', text: 'Create multi-row track' },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Create multi-row track' } },
          {
            type: 'text',
            x: 60,
            y: 330,
            maxWidth: 300,
            text: 'Open the selection cart and click Create multi-row track',
          },
        ],
      },
    ],
  },

  {
    mode: 'url',
    name: 'multiwig/addtrack',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
    }),
    readyText: 'ctgA',
    viewportWidth: 1300,
    viewportHeight: 520,
    actions: [
      { type: 'click', text: 'File' },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'click', text: 'Open track...' },
      { type: 'waitForText', text: 'Enter track data' },
    ],
    stages: [
      {
        actions: [
          { type: 'click', text: 'Add a track from file or URL' },
          { type: 'waitForText', text: 'Add multi-row track' },
          { type: 'delay', ms: 800 },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Add multi-row track' } },
          {
            type: 'text',
            text: 'The workflow dropdown reaches the multi-row form',
            maxWidth: 320,
            leader: true,
            anchor: { text: 'Add multi-row track', alignX: 'left' },
            dx: -60,
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Add multi-row track' },
          { type: 'waitForText', text: 'Add' },
          { type: 'delay', ms: 1200 },
        ],
        annotations: [
          {
            type: 'box',
            anchor: {
              selector: 'textarea[placeholder$="/sample1.bw"]',
            },
          },
          {
            type: 'text',
            text: 'Paste wiggle file URLs here',
            leader: true,
            anchor: {
              selector: 'textarea[placeholder$="/sample1.bw"]',
              alignX: 'left',
            },
            dx: -60,
          },
        ],
      },
    ],
  },

  // A copy-number-polymorphic window, so the PUR rows have something to
  // cluster on.
  {
    mode: 'url',
    name: 'multiwig/cluster_dialog',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr3:162,275,163-163,360,944',
      tracks: [
        {
          trackId: 'pur_copynumber_1000g',
          height: 420,
          mark: 'span',
          // Most cells sit at copy number 2, so the default 99th-percentile
          // clip clamps the amplifications near 2.2.
          encoding: { y: { scale: { fenceQuantile: 1 } } },
          // a dendrogram would imply a phylogeny
          axis: { tree: false },
        },
      ],
    }),
    readyText: 'PUR',
    readySelector: displayPainted('wiggle-display'),
    readyTimeout: 90000,
    viewportHeight: 620,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          { type: 'waitForText', text: 'Clustering' },
          { type: 'hover', text: 'Clustering' },
          { type: 'waitForText', text: 'Cluster rows by score...' },
          { type: 'click', text: 'Cluster rows by score...' },
          { type: 'waitForText', text: 'Run clustering' },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Run clustering' },
          { type: 'waitForText', text: 'Run clustering', hidden: true },
        ],
      },
    ],
  },
]
