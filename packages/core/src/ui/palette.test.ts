/**
 * Parity between `resolvePalette` (plain data, no toolkit) and the MUI theme
 * `createJBrowseTheme` builds.
 *
 * This is the load-bearing test of the palette extraction. The config `theme`
 * slot is public API shaped as MUI `ThemeOptions`, so every existing config has
 * to keep resolving to the colors it resolved to before. If MUI changes its
 * augmentation or its neutral defaults on an upgrade, this fails here rather
 * than as a subtly different browser.
 *
 * Both sides are flattened to the same plain shape so a mismatch reads as one
 * diff instead of forty assertions.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { createTheme } from '@mui/material'

import {
  augmentColor,
  methylated5hmC,
  methylated5mC,
  resolvePalette,
  unmethylated5mC,
} from './palette.ts'
import { createJBrowseTheme, defaultThemes } from './theme.ts'

import type {
  BaseKey,
  ColorInput,
  ColorQuad,
  JBrowsePalette,
  StringColors,
} from './palette.ts'
import type { SerializableThemeArgs } from './theme.ts'

const stringKeys: (keyof StringColors)[] = [
  'stopCodon',
  'startCodon',
  'codonNonsynonymous',
  'codonSynonymous',
  'codonStop',
  'coverage',
  'insertion',
  'softclip',
  'skip',
  'hardclip',
  'deletion',
  'modificationFwd',
  'modificationRev',
  'mutedSnpBase',
  'missingData',
  'gridlineMinor',
  'gridlineMajor',
  'plotGridlineMinor',
  'plotGridlineMajor',
  'regionBoundary',
  'featureHover',
  'featureHoverStrong',
  'featureSelected',
  'featureDescription',
]

const baseKeys: BaseKey[] = ['A', 'C', 'G', 'T', 'N']
const quadKeys = [
  'primary',
  'secondary',
  'tertiary',
  'quaternary',
  'highlight',
  'textHighlight',
  'error',
  'warning',
  'info',
  'success',
] as const

const greyKeys = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const

// the MUI palette and JBrowsePalette are structurally the same for everything
// asserted here, so one flattener serves both sides
type PaletteLike = Pick<JBrowsePalette, (typeof quadKeys)[number]> &
  Omit<JBrowsePalette, (typeof quadKeys)[number]>

function quad(entry: ColorQuad) {
  return {
    main: entry.main,
    light: entry.light,
    dark: entry.dark,
    contrastText: entry.contrastText,
  }
}

function flatten(palette: PaletteLike) {
  return {
    mode: palette.mode,
    strings: Object.fromEntries(stringKeys.map(k => [k, palette[k]])),
    text: {
      primary: palette.text.primary,
      secondary: palette.text.secondary,
      disabled: palette.text.disabled,
    },
    background: {
      paper: palette.background.paper,
      default: palette.background.default,
    },
    divider: palette.divider,
    common: { black: palette.common.black, white: palette.common.white },
    grey: Object.fromEntries(greyKeys.map(k => [k, palette.grey[k]])),
    action: {
      active: palette.action.active,
      hover: palette.action.hover,
      hoverOpacity: palette.action.hoverOpacity,
      selected: palette.action.selected,
      selectedOpacity: palette.action.selectedOpacity,
      disabled: palette.action.disabled,
      disabledBackground: palette.action.disabledBackground,
      disabledOpacity: palette.action.disabledOpacity,
      focus: palette.action.focus,
      focusOpacity: palette.action.focusOpacity,
      activatedOpacity: palette.action.activatedOpacity,
    },
    colors: Object.fromEntries(quadKeys.map(k => [k, quad(palette[k])])),
    bases: Object.fromEntries(baseKeys.map(k => [k, quad(palette.bases[k])])),
    frames: palette.frames.map(f => (f ? quad(f) : null)),
    framesCDS: palette.framesCDS.map(f => (f ? quad(f) : null)),
    alignmentFill: { ...palette.alignmentFill },
  }
}

function fromMui(args: SerializableThemeArgs) {
  const theme = createJBrowseTheme(
    args.configTheme,
    { ...defaultThemes, ...args.extraThemes },
    args.themeName,
  )
  return flatten(theme.palette)
}

function expectParity(args: SerializableThemeArgs) {
  expect(flatten(resolvePalette(args))).toEqual(fromMui(args))
}

/**
 * The drift guard.
 *
 * `theme.ts` now consumes `resolvePalette`, so the whole-palette comparisons
 * below round-trip our own values through `createTheme` and would still pass if
 * our color math and MUI's diverged. This test does not: it checks
 * `augmentColor` against MUI's own `augmentColor` directly, which is what
 * catches an upstream change to the tonal offset, the contrast threshold or the
 * channel rounding. It is the reason a config `theme` slot written years ago
 * keeps resolving to the colors it always did.
 */
describe('augmentColor matches MUI', () => {
  // Compared on the four shades only: MUI spreads its input, so a shade map
  // comes back still carrying its 300/500/700 stops, where `augmentColor`
  // returns just what `ColorQuad` promises. MUI also has no bare-string form,
  // so normalize that before handing it over.
  const muiAugment = (input: ColorInput) =>
    quad(
      createTheme().palette.augmentColor({
        color: typeof input === 'string' ? { main: input } : input,
      }),
    )

  test.each([
    ['brand midnight', '#0D233F'],
    ['brand mandarin', '#FFB11D'],
    ['near-white', '#f5f5f5'],
    ['near-black', '#111111'],
    // truncation bites hardest where a channel lands just under an integer
    ['odd channels', '#0d1f2b'],
    ['three-digit hex', '#aaa'],
    ['mid grey, contrast threshold boundary', '#767676'],
    ['saturated red', '#f44336'],
  ])('%s', (_name, main) => {
    expect(augmentColor(main)).toEqual(muiAugment({ main }))
  })

  test('a shade map takes light/dark from its 300/700 stops', () => {
    const color = { 300: '#81c784', 500: '#4caf50', 700: '#388e3c' }
    expect(augmentColor(color)).toEqual(muiAugment(color))
  })

  test('explicit shades are passed through untouched', () => {
    const color = { main: '#123456', light: '#abcdef', contrastText: '#010101' }
    expect(augmentColor(color)).toEqual(muiAugment(color))
  })
})

test.each(Object.keys(defaultThemes))('built-in theme %s', name => {
  expectParity({ themeName: name })
})

test('no arguments at all', () => {
  expectParity({})
})

test('config theme overriding a bare main', () => {
  expectParity({ configTheme: { palette: { primary: { main: '#2a9d8f' } } } })
})

test('config theme overriding string colors and mode together', () => {
  expectParity({
    configTheme: {
      palette: {
        mode: 'dark',
        featureDescription: '#ffcc00',
        gridlineMajor: 'rgba(255,0,0,0.5)',
      },
    },
  })
})

test('config theme overriding one base and one CDS frame', () => {
  expectParity({
    configTheme: {
      palette: {
        bases: { A: { main: '#112233' } },
        // a frame tuple entry is an object rather than a bare string: that is
        // what the MUI-shaped config slot has always accepted
        framesCDS: [
          null,
          { main: '#ff0000' },
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
        ],
      },
    },
  })
})

test('config theme overriding alignmentFill partially', () => {
  expectParity({
    configTheme: { palette: { alignmentFill: { pairRL: '#abcdef' } } },
  })
})

// a named preset is a fixed set of colors and deliberately ignores configTheme
test('a named preset ignores the config theme', () => {
  expectParity({
    themeName: 'darkStock',
    configTheme: { palette: { primary: { main: '#2a9d8f' } } },
  })
})

test('an extraThemes entry that declares almost nothing', () => {
  expectParity({
    themeName: 'custom',
    extraThemes: { custom: { palette: { mode: 'dark' } } },
  })
})

test('an extraThemes entry with brand colors of its own', () => {
  expectParity({
    themeName: 'custom',
    extraThemes: {
      custom: {
        palette: {
          primary: { main: '#004643' },
          tertiary: { main: '#f9bc60' },
          highlight: { main: '#e16162' },
        },
      },
    },
  })
})

// The methylation colors are deliberately not palette members. The alignments
// worker packs them to ABGR per modified base and returns them *inside* its
// vertex data, so unlike `modificationFwd`/`modificationRev` — which the
// renderer sets as shader uniforms, and which are palette members for exactly
// that reason — a theme cannot move them without invalidating the fetch that
// produced the vertices. Promoting one to `StringColors` compiles, redraws
// nothing, and leaves the legend swatch reading the new color while the pixels
// keep the old one until the next fetch.
test('the methylation colors are constants, not palette members', () => {
  for (const color of [methylated5mC, unmethylated5mC, methylated5hmC]) {
    expect(color).toMatch(/^#[0-9a-f]{6}$/)
  }
  for (const themeName of Object.keys(defaultThemes)) {
    for (const key of ['methylated5mC', 'unmethylated5mC', 'methylated5hmC']) {
      expect(key in resolvePalette({ themeName })).toBe(false)
      expect(
        key in createJBrowseTheme({}, defaultThemes, themeName).palette,
      ).toBe(false)
    }
  }
})

// `@jbrowse/core/ui/palette` is the entry that gets those constants without
// Material UI: `ui/theme` re-exports them but imports `createTheme`, so a
// worker reaching through it for one color pulls the toolkit into its bundle.
// That property is not visible from inside the file — one convenience import of
// `alpha` or `getContrastText` from MUI would end it silently, which is why
// this module has its own copies of both — and it is transitive, so walk it
// rather than reading the import block. Value imports only; `import type` is
// erased.
function toolkitReachedFrom(entry: string) {
  const bare = new Set<string>()
  const seen = new Set<string>()
  const walk = (file: string) => {
    if (seen.has(file)) {
      return
    }
    seen.add(file)
    const specs = [
      ...readFileSync(file, 'utf8').matchAll(
        /^(?:import|export)\s+(type\s+)?[^;]*?from\s+'([^']+)'/gm,
      ),
    ]
      .filter(m => !m[1])
      .map(m => m[2]!)
    for (const spec of specs) {
      if (spec.startsWith('.')) {
        walk(path.join(path.dirname(file), spec))
      } else {
        bare.add(spec)
      }
    }
  }
  walk(path.join(__dirname, entry))
  return [...bare].filter(s => /^(react|@mui\/|@emotion\/)/.test(s))
}

test('the palette entry reaches no React, MUI or emotion', () => {
  expect(toolkitReachedFrom('palette.ts')).toEqual([])
})

// The walk is only worth trusting if it can see a violation, and `theme.ts` is
// the exact negative case: it re-exports every constant `palette.ts` declares
// and brings `createTheme` with them, which is the whole reason worker code is
// pointed at the other entry.
test('the walk would catch it (theme.ts, which re-exports these, fails)', () => {
  expect(toolkitReachedFrom('theme.ts')).toEqual(['@mui/material'])
})
