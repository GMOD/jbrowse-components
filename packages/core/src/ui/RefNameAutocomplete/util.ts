import BaseResult from '../../TextSearch/BaseResults.ts'
import { measureText } from '../../util/index.ts'

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

export function getFiltered(options: Option[], inputValue: string) {
  const query = inputValue.toLowerCase()
  return cap(
    options.filter(({ result }) =>
      result.getLabel().toLowerCase().includes(query),
    ),
  )
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
