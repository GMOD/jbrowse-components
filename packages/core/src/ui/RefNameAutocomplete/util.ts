import BaseResult, { RefSequenceResult } from '../../TextSearch/BaseResults.ts'
import { measureText } from '../../util/index.ts'
import { globToRegExp } from '../../util/selectNamedRegions.ts'

// matches the rendered font-size of the TextField
const INPUT_FONT_SIZE = 14
// input padding + search icon + right margin (excludes the optional help button)
export const ADORNMENT_RESERVE_PX = 70
// extra room for the help IconButton, only reserved when it is actually shown
export const HELP_BUTTON_RESERVE_PX = 30
// quantize the computed width to this step so short locstring length changes (a
// digit/comma appearing while panning/zooming) don't reflow the box and jitter
// the surrounding header; also gives short values a little pleasant slack
const WIDTH_STEP_PX = 30

// MUI Autocomplete is not virtualized, so a broad query that returns thousands
// of hits would render thousands of DOM nodes; cap the visible list instead
export const MAX_OPTIONS = 100

export interface Option {
  isLimit?: boolean
  result: BaseResult
}

export function cap(options: Option[]) {
  return options.length > MAX_OPTIONS
    ? [
        ...options.slice(0, MAX_OPTIONS),
        {
          isLimit: true,
          result: new BaseResult({ label: 'keep typing for more results' }),
        },
      ]
    : options
}

// How many matches a glob may gather into the one "show all" option below.
// Displaying a few hundred whole chromosomes is ordinary — GRCh38 with its alts
// and decoys is ~640 refNames, and showAllRegionsInAssembly lays out every one —
// so the ceiling sits well above any real chromosome set. Past it, the option is
// withheld rather than truncated: a bulk action that reads "all of them" and
// navigates to the first thousand is the one behaviour not worth having, and the
// individual options are still listed for picking one at a time.
export const MAX_SELECT_ALL = 1000

/**
 * One option carrying every match as a whitespace-separated locstring — the
 * multi-region form the box already accepts, and the form it already displays
 * once a view holds more than one region. So picking it takes exactly the path
 * typing those names by hand takes (`parseLocStrings` → `navToLocations` →
 * `setDisplayedRegions` + `showAllRegions`), and there is no bulk-navigation
 * code anywhere to keep in step with the single-region kind.
 *
 * It goes first in the list, and it is the reason a glob belongs in the picker
 * rather than in the locstring parser: the set is on screen, and counted, before
 * it is committed to. A pattern typed straight at the parser would resolve to
 * however many regions it happened to match, sight unseen.
 */
function selectAllOption(matches: string[], pattern: string): Option {
  return {
    result: new BaseResult({
      label: `Show all ${matches.length} regions matching ${pattern}`,
      locString: matches.join(' '),
    }),
  }
}

// The part of an Assembly this needs, duck-typed so the matching can be tested
// without building one.
export interface RefNameSource {
  regions?: readonly { refName: string }[]
  // canonical names AND aliases. Undefined until the assembly's aliases load
  allRefNames?: readonly string[]
  getCanonicalRefName: (name: string) => string | undefined
}

/**
 * The browse/pre-fetch fallback list, shown while a typed query is in flight and
 * when it comes back empty (typed queries otherwise resolve through
 * fetchResults). An assembly can hold ~10^6 refNames, so this stays bounded:
 * matching stops once it has one hit past whichever cap applies, and nothing is
 * sliced before filtering — slicing first would hide every refName past the cap
 * from the filter, so a substring of a late scaffold's name matched nothing.
 * That extra hit is what lets `cap` render its "keep typing" hint.
 *
 * A query containing `*` is ALSO read as an anchored glob, the same reading
 * `selectNamedRegions` gives a `displayedRegionNames` entry — so `*_MATERNAL`
 * picks out a haplotype here exactly as it does in a session spec. Read as well
 * as, never instead of, the substring match: `*` is a legal refName character
 * (GRCh38's ALT decoys are HLA allele names like `HLA-A*01:01:01:01`), so a
 * literal hit must not be lost to the pattern reading of the same text. Union,
 * rather than selectNamedRegions' literal-first rule, because this is a filter
 * and not a resolver — an extra row in a list the user is looking at costs
 * nothing, where an extra region in a resolved set is a wrong answer.
 *
 * BOTH READINGS MATCH ALIASES, and resolve their hits to the canonical name, so
 * a pattern sees the names a user actually types. `chr*` has to work on an
 * assembly whose FASTA calls its chromosomes `1`, `2`, `3`, and matching
 * `regions` alone — canonical names only — meant it silently matched nothing
 * there. `searchRefNames`, which fills this same dropdown whenever the text
 * index answers, has always searched `allRefNames`; a glob is precisely the
 * query it can never answer (nothing PREFIX-matches the literal `chr*`), so
 * without this the two halves of one dropdown disagreed about which names exist.
 * Labelling with the canonical name is also its choice, and for its reason: it
 * is the name the view will display.
 */
export function getRefNameOptions(
  assembly: RefNameSource | undefined,
  inputValue: string,
) {
  const regions = assembly?.regions ?? []
  const query = inputValue.toLowerCase()
  const glob = query.includes('*') ? globToRegExp(query, 'i') : undefined
  // A glob may gather up to MAX_SELECT_ALL for its bulk row; a plain query never
  // needs more than the visible list, so it keeps the tighter bound it had.
  const ceiling = glob ? MAX_SELECT_ALL : MAX_OPTIONS
  // Every name the assembly answers to — aliases and canonical alike, since
  // buildRefNameMaps identity-maps each region, so this is never short of
  // `regions`. There is deliberately no canonical-only fallback for "aliases
  // haven't loaded": `setLoaded` writes regions and refNameAliases in ONE
  // action, so an absent list means an unloaded assembly, whose `regions` is
  // equally absent and which therefore has nothing to list either way. Writing
  // the fallback anyway would mean a glob quietly matching a smaller set of
  // names in a state that cannot arise — the silent half-answer this whole
  // alias fix exists to remove. It is also what makes getCanonicalRefName safe
  // to call, since that THROWS before aliases load and is only ever reached
  // here for a name that came out of this list.
  const candidates = assembly?.allRefNames ?? []
  const canonical = (n: string) => assembly?.getCanonicalRefName(n) ?? n

  // Which regions match, by canonical name. Several aliases collapsing onto one
  // region is the ordinary case (`chr1`, `NC_000001.11` and `1` are one contig),
  // so this is a Set rather than a count.
  const hits = new Set<string>()
  for (const name of candidates) {
    if (name.toLowerCase().includes(query) || glob?.test(name)) {
      hits.add(canonical(name))
      if (hits.size > ceiling) {
        break
      }
    }
  }

  // Emitted by walking `regions`, so the list is in ASSEMBLY order rather than
  // whatever order the alias file happened to list its names in — the same
  // two-pass shape, for the same reason, as selectNamedRegions' glob branch.
  const options: Option[] = []
  const matches: string[] = []
  for (const { refName } of regions) {
    if (!hits.has(refName)) {
      continue
    }
    if (options.length <= MAX_OPTIONS) {
      options.push({
        result: new RefSequenceResult({ refName, label: refName }),
      })
    }
    matches.push(refName)
    // every hit is placed, so there is nothing later in `regions` to find
    if (matches.length === hits.size) {
      break
    }
  }
  return glob && matches.length > 1 && matches.length <= MAX_SELECT_ALL
    ? [selectAllOption(matches, inputValue), ...options]
    : options
}

// group hits sharing a display string into a single multi-result option (the
// picker pops a dialog), leaving unique hits as plain options
export function getDeduplicatedResult(results: BaseResult[]): Option[] {
  const m = new Map<string, BaseResult[]>()
  for (const result of results) {
    const key = result.getDisplayString()
    const dupes = m.get(key)
    if (dupes) {
      dupes.push(result)
    } else {
      m.set(key, [result])
    }
  }
  return [...m].map(([displayString, dupes]) =>
    dupes.length === 1
      ? { result: dupes[0]! }
      : {
          result: new BaseResult({
            displayString,
            results: dupes,
            label: displayString,
          }),
        },
  )
}

// MUI freeSolo hands back the raw typed string when nothing in the list is
// selected; wrap it so callers always get a BaseResult
export function coerceToResult(option: string | Option) {
  return typeof option === 'string'
    ? new BaseResult({ label: option })
    : option.result
}

export function getOptionLabel(option: string | Option) {
  return typeof option === 'string' ? option : option.result.getDisplayString()
}

// sized to the committed locstring, not the in-progress typed text, so the box
// doesn't jitter while typing a long query. Quantized to WIDTH_STEP_PX so small
// length changes during navigation don't continuously reflow the box.
export function getInputWidth(
  value: string,
  minWidth: number,
  maxWidth: number,
  adornmentWidth = ADORNMENT_RESERVE_PX + HELP_BUTTON_RESERVE_PX,
) {
  const raw = measureText(value, INPUT_FONT_SIZE) + adornmentWidth
  const stepped = Math.ceil(raw / WIDTH_STEP_PX) * WIDTH_STEP_PX
  return Math.min(Math.max(stepped, minWidth), maxWidth)
}
