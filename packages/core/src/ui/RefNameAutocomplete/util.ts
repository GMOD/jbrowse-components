import BaseResult, { RefSequenceResult } from '../../TextSearch/BaseResults.ts'
import { measureText } from '../../util/index.ts'
import {
  MAX_GLOB_REGIONS,
  matchRefNames,
} from '../../util/selectNamedRegions.ts'

import type { RefNameMatchSource } from '../../util/selectNamedRegions.ts'

// matches the rendered font-size of the TextField
const INPUT_FONT_SIZE = 14
// input padding + search icon + right margin (excludes the overflow button)
const ADORNMENT_RESERVE_PX = 70
// extra room for the ⋮ IconButton, only reserved when it is actually drawn
const OVERFLOW_BUTTON_RESERVE_PX = 30
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

/**
 * The refName the typed text names outright, canonicalized — or undefined.
 *
 * Reading the name out of `allRefNames` before canonicalizing is what keeps
 * `getCanonicalRefName`, which throws before aliases load, off a name the
 * assembly never listed.
 */
function literalRefName(
  assembly: RefNameMatchSource | undefined,
  inputValue: string,
) {
  const query = inputValue.toLowerCase()
  const named = assembly?.allRefNames?.find(n => n.toLowerCase() === query)
  return named === undefined
    ? undefined
    : (assembly?.getCanonicalRefName(named) ?? named)
}

/**
 * The browse/pre-fetch fallback list, shown while a typed query is in flight and
 * when it comes back empty (typed queries otherwise resolve through
 * fetchResults).
 *
 * The matching itself is `matchRefNames`, in core beside the glob semantics,
 * because Enter answers for the same typed text and the two must not each grow
 * their own reading of it. What is left here is presentation: how many rows to
 * materialize, and the bulk row.
 *
 * **AN EXACT REFNAME BEATS THE GLOB READING here too**, the rule
 * `selectNamedRegions` states and `searchUtils` orders its glob branch after.
 * `*` is a legal refName character and GRCh38's ALT decoys are HLA allele names,
 * so `HLA-A*01:01:01:01` is a contig somebody typed in full — offering "Show all
 * 4 regions matching HLA-A*01:01:01:01" above it is the box promising a set that
 * Enter, on the same text, does not open. The individual matches still list: the
 * pattern reading is not wrong, it is just not what leads.
 *
 * A glob may gather up to MAX_GLOB_REGIONS for that bulk row; a plain query
 * never needs more than the visible list, so it keeps the tighter bound and the
 * cost it always had. Collecting one past MAX_OPTIONS is what lets `cap` render
 * its "keep typing" hint.
 */
export function getRefNameOptions(
  assembly: RefNameMatchSource | undefined,
  inputValue: string,
) {
  const literal = literalRefName(assembly, inputValue)
  const isGlob = literal === undefined && inputValue.includes('*')
  const matches = matchRefNames(
    assembly,
    inputValue,
    isGlob ? MAX_GLOB_REGIONS : MAX_OPTIONS,
  )
  // hoisted only when the scan actually reached it — past the ceiling
  // `matchRefNames` stops early, and a name with no region behind it is not an
  // option anyone can pick
  const ordered =
    literal !== undefined && matches.includes(literal)
      ? [literal, ...matches.filter(refName => refName !== literal)]
      : matches
  const options: Option[] = ordered.slice(0, MAX_OPTIONS + 1).map(refName => ({
    result: new RefSequenceResult({ refName, label: refName }),
  }))
  return isGlob && matches.length > 1 && matches.length <= MAX_GLOB_REGIONS
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

/**
 * What the end adornment occupies, and the number a caller passes as
 * `adornmentWidth`.
 *
 * The ⋮ button is drawn for consumer-supplied rows as well as for the help one,
 * so the reservation follows `menuItemCount || showHelp` — the same expression
 * `EndAdornment` renders on. Both read it here rather than adding the constants
 * up at the call site, which yields a box that has the button and is sized as
 * if it did not.
 */
export function adornmentReservePx({
  showHelp,
  menuItemCount = 0,
}: {
  showHelp?: boolean
  menuItemCount?: number
}) {
  return (
    ADORNMENT_RESERVE_PX +
    (menuItemCount || showHelp ? OVERFLOW_BUTTON_RESERVE_PX : 0)
  )
}

// sized to the committed locstring, not the in-progress typed text, so the box
// doesn't jitter while typing a long query. Quantized to WIDTH_STEP_PX so small
// length changes during navigation don't continuously reflow the box.
export function getInputWidth(
  value: string,
  minWidth: number,
  maxWidth: number,
  adornmentWidth = ADORNMENT_RESERVE_PX + OVERFLOW_BUTTON_RESERVE_PX,
) {
  const raw = measureText(value, INPUT_FONT_SIZE) + adornmentWidth
  const stepped = Math.ceil(raw / WIDTH_STEP_PX) * WIDTH_STEP_PX
  return Math.min(Math.max(stepped, minWidth), maxWidth)
}
