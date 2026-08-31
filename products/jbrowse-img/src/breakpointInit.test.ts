import {
  breakpointInit,
  breakpointLocs,
  breakpointPanelsFromSpec,
  breakpointTracks,
} from './breakpointInit.ts'

import type { Entry } from './parseArgv.ts'
import type { Config, Opts } from './types.ts'

function config(openTracks?: { trackId: string; opts: string[] }[]): Config {
  return {
    assemblies: [{ name: 'hg38', sequence: {} }],
    assembly: { name: 'hg38', sequence: {} },
    tracks: [],
    ...(openTracks ? { openTracks } : {}),
  }
}

// Two panels, the shape of an ordinary BND, as parseArgv would hand it over.
const BND: Entry[] = [
  ['loc', ['chr3:25,358,000-25,361,000']],
  ['bam', ['tumor.bam']],
  ['loc', ['chr10:58,716,500-58,718,500']],
]

function opts(argv: Entry[]): Opts {
  return { argv }
}

describe('breakpointLocs', () => {
  it('makes one panel per --loc flag, in argv order', () => {
    expect(breakpointLocs(BND)).toEqual([
      'chr3:25,358,000-25,361,000',
      'chr10:58,716,500-58,718,500',
    ])
  })

  it('keeps whitespace inside one --loc as several windows of ONE panel', () => {
    // The two levels the flag has to distinguish: repeating --loc stacks a
    // panel, a space inside one adds a region to that panel. Collapsing them
    // onto whitespace renders one picture when the user asked for the other.
    expect(
      breakpointLocs([
        ['loc', ['chr1:1-100 chr1:5,000-5,100']],
        ['loc', ['chr5:1-100']],
      ]),
    ).toEqual(['chr1:1-100 chr1:5,000-5,100', 'chr5:1-100'])
  })

  it('joins an unquoted flag’s tokens rather than dropping all but the first', () => {
    // standardizeArgv takes vals[0], which silently loses the second window.
    // Joining makes the quoted and unquoted spellings mean the same thing.
    expect(breakpointLocs([['loc', ['chr1:1-100', 'chr1:5-6']]])).toEqual([
      'chr1:1-100 chr1:5-6',
    ])
  })

  it('falls back to opts.loc when there is no argv (programmatic call)', () => {
    expect(breakpointLocs(undefined, 'chr1:1-100')).toEqual(['chr1:1-100'])
    expect(breakpointLocs(undefined)).toEqual([])
  })

  it('ignores other flags entirely', () => {
    expect(breakpointLocs([['bam', ['x.bam']]])).toEqual([])
  })
})

describe('breakpointTracks', () => {
  it('puts hosted --track ids before the file-flag tracks, argv order', () => {
    expect(
      breakpointTracks(
        [{ trackId: 'file_bam', opts: [] }],
        [{ trackId: 'hosted_genes', opts: [] }],
      ),
    ).toEqual([{ trackId: 'hosted_genes' }, { trackId: 'file_bam' }])
  })

  it('is empty rather than undefined when nothing was opened', () => {
    expect(breakpointTracks(undefined, [])).toEqual([])
  })

  // Every other mode routes --track modifiers through applyDisplayOpts, which
  // a breakpoint panel never reaches: it opens its tracks from `init`. They
  // used to be dropped there in silence, so `height:240 force:true` parsed,
  // validated, and did nothing.
  it('folds the track modifiers into the panel TrackInit', () => {
    expect(
      breakpointTracks(
        undefined,
        [{ trackId: 'tumor_bam', opts: ['height:240', 'force:true'] }],
        [{ trackId: 'tumor_bam', type: 'AlignmentsTrack' }],
      ),
    ).toEqual([{ trackId: 'tumor_bam', height: 240, forceLoad: true }])
  })
})

describe('breakpointInit', () => {
  it('builds one panel per --loc, all on the same assembly', () => {
    const init = breakpointInit(config(), opts(BND), [])
    expect(init).toHaveLength(2)
    expect(init.map(v => v.loc)).toEqual([
      'chr3:25,358,000-25,361,000',
      'chr10:58,716,500-58,718,500',
    ])
    expect(init.every(v => v.assembly === 'hg38')).toBe(true)
  })

  it('shows every track on EVERY panel', () => {
    // The connecting curves are drawn only across `matchedTracks` — the tracks
    // present in all panels — so a track on one panel contributes no ribbon and
    // the export would be a stack of unrelated windows.
    const init = breakpointInit(
      config([{ trackId: 'tumor_bam', opts: [] }]),
      opts(BND),
      [],
    )
    expect(init.map(v => v.tracks)).toEqual([
      [{ trackId: 'tumor_bam' }],
      [{ trackId: 'tumor_bam' }],
    ])
  })

  it('takes as many panels as the chain has hops, not two', () => {
    // COLO829's der(3) visits four loci. A --loc/--loc2 flag pair could not
    // express this, which is why the panel count comes from the input.
    const init = breakpointInit(
      config(),
      opts([
        ['loc', ['chr3:1-2']],
        ['loc', ['chr10:1-2']],
        ['loc', ['chr12:1-2']],
        ['loc', ['chr3:9-10']],
      ]),
      [],
    )
    expect(init).toHaveLength(4)
  })

  it('refuses one panel, and names the repeat-the-flag fix', () => {
    // The quoted single --loc is the mistake worth catching: it is the spelling
    // a multi-region LGV takes, so it would otherwise render one panel with two
    // windows and nothing connecting them.
    expect(() =>
      breakpointInit(config(), opts([['loc', ['chr1:1-100 chr5:1-100']]]), []),
    ).toThrow(/at least two.*Repeat the flag/s)
  })

  it('refuses no --loc at all', () => {
    expect(() => breakpointInit(config(), opts([]), [])).toThrow(/got 0/)
  })
})

describe('breakpointPanelsFromSpec', () => {
  const panels = [
    { assembly: 'hg38', loc: 'chr1:1-2', tracks: ['t'] },
    { assembly: 'hg38', loc: 'chr5:1-2', tracks: ['t'] },
  ]

  it('takes the views array as the panels', () => {
    expect(breakpointPanelsFromSpec({ views: panels })).toEqual(panels)
  })

  it("refuses v4's bare array under init", () => {
    expect(() => breakpointPanelsFromSpec({ init: panels })).toThrow(
      /needs a "views" array/,
    )
  })

  it('refuses a spec whose panels are not an array', () => {
    // The shared viewSettingsFromSpec would hand `{views: {...}}` over and the
    // view would read it as no panels, rendering empty instead of failing.
    expect(() =>
      breakpointPanelsFromSpec({ views: { loc: 'chr1:1-2' } }),
    ).toThrow(/needs a "views" array/)
  })

  it('refuses a one-panel spec', () => {
    expect(() =>
      breakpointPanelsFromSpec({
        views: [{ assembly: 'hg38', loc: 'chr1:1-2' }],
      }),
    ).toThrow(/at least two panels/)
  })
})
