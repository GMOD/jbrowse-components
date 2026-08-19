import { Suspense, lazy } from 'react'

import {
  isSlotCustomized,
  makePin,
} from '../configuration/promotableDefaults.ts'
import { INLINE_MENU_ROW_WIDTH } from './inlineMenuRowWidth.ts'

import type { Pin } from '../configuration/promotableDefaults.ts'
import type { ResolvableDisplay } from '../configuration/promotableResolve.ts'
import type {
  AnyConfigurationModel,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
} from '../configuration/types.ts'
import type { MenuItem } from './MenuTypes.ts'
import type { SliderScale } from './sliderScale.ts'

// The row's drawn half is `lazy()` for the reason the promotable pin is a
// description rather than an element: this builder is called from state models
// and menu modules, which are eager, and the row is the only route by which MUI
// `Slider` — the largest single Material component in the eager graph — reached
// a host's first paint. `type: 'custom'` already made `render` a thunk, so the
// laziness is free at call time; it is the module edge that had to go.
//
// The fallback holds the row's footprint so the open menu doesn't reflow when
// the chunk lands. Height is the row's natural one (caption line + slider); it
// is approximate on purpose, since being a few px out for one frame is
// invisible where a collapse to zero is not.
const SizeSliderRow = lazy(() =>
  import('./SizeSliderRow.tsx').then(m => ({ default: m.SizeSliderRow })),
)

const sizeRowFallbackHeight = 46

// One inline menu row: the live value/slider with a reset button and, for a
// promotable slot, a pin to make the current value the session-wide default.
//
// `getValue` is a thunk, read inside `SizeSliderRow`'s own observer, so the
// slider tracks the model while the menu stays open. Not because the built row
// is never rebuilt — `CascadingMenu` calls a `MenuItemsGetter` inside its own
// observer render, so a menu built from a getter does rebuild on the write —
// but because `menuItems` may equally be a plain `MenuItem[]`, which nothing
// rebuilds, and a captured number would then go stale mid-drag.
//
// It does NOT isolate this row from the rebuild: `makePromotableSizeMenu` reads
// the slot eagerly for the pin and the reset gate, so a getter-built menu still
// re-derives every row on every drag frame. Worth knowing before treating the
// thunk as a perf boundary; making it one means deriving those two lazily too.
//
// `commitOnRelease` is for callers whose onChange is expensive (e.g. the
// alignments modification threshold fires a tier-1 worker refetch, GC-content
// window size triggers a reload): the thumb follows a local drag value and only
// calls onChange when the drag ends. While not dragging, dragValue is undefined
// so the row still reflects the model (including external resets).
// Everything a size row needs that doesn't depend on where its "is this the
// default?" answer comes from — the one axis the two entry points below differ
// on.
interface SizeMenuOptions {
  label: string
  title: string
  getValue: () => number
  min?: number
  max?: number
  step?: number
  unit?: string
  scale?: SliderScale
  format?: (n: number) => string
  commitOnRelease?: boolean
  onChange: (n: number) => void
  onReset: () => void
}

// Shared inline "size" control as a single menu row (was a submenu of
// slider/reset/default). Callers own their config slot/semantics and wire the
// accessors + a title (which also derives the slider's test id). Used by wiggle
// point-size/line-width, GWAS Manhattan point-size, arc width, the alignments
// modification threshold and GC-content window/step sizes, so the
// slider/reset/pin behavior can't drift. Pass `scale: 'log'` for values spanning
// orders of magnitude, and `format` to label non-`px` units.
//
// For a row over a promotable slot use `makePromotableSizeMenu`.
export function makeSizeMenu(
  opts: SizeMenuOptions & { isDefault: boolean },
): MenuItem {
  return sizeMenu(opts, opts.isDefault)
}

// The same row over a **promotable** slot, which derives both halves the plain
// form takes by hand — the reset button's enablement (`isSlotCustomized`) and
// the "default for all tracks of this type" pin — from the one slot name. A
// slider has no fixed on-value, so the pin promotes whatever the track is
// currently showing.
//
// Naming the slot once is the point: the call sites used to spell it twice, in
// `isDefault` and again in the pin, with nothing checking the two agreed.
export function makePromotableSizeMenu<
  CONFMODEL extends AnyConfigurationModel,
  SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  opts: SizeMenuOptions & {
    display: ResolvableDisplay<CONFMODEL>
    slot: SLOT
  },
): MenuItem {
  const { display, slot } = opts
  return sizeMenu(
    opts,
    !isSlotCustomized(display, slot),
    makePin(display, slot),
  )
}

function sizeMenu(
  opts: SizeMenuOptions,
  isDefault: boolean,
  pin?: Pin,
): MenuItem {
  const {
    label,
    title,
    getValue,
    min = 0.5,
    max = 12,
    step = 0.5,
    unit = 'px',
    scale = 'linear',
    format = (n: number) => `${n}${unit}`,
    commitOnRelease,
    onChange,
    onReset,
  } = opts
  return {
    label,
    type: 'custom',
    // Declared even though `SizeSliderRow` below is what draws it: a custom row
    // never reaches the shared trailing column, so without this the pin exists
    // on screen and is invisible to `pinnedSlots` — which is the difference
    // between a promotable slot that is genuinely unreachable and one that just
    // renders its own control. See `hasMenuItemAdornment` for why declaring it
    // costs no layout.
    ...(pin && {
      pin: { control: pin, label: title },
    }),
    render: () => (
      <Suspense
        fallback={
          <div
            style={{
              width: INLINE_MENU_ROW_WIDTH,
              height: sizeRowFallbackHeight,
            }}
          />
        }
      >
        <SizeSliderRow
          title={title}
          getValue={getValue}
          min={min}
          max={max}
          step={step}
          scale={scale}
          format={format}
          isDefault={isDefault}
          commitOnRelease={commitOnRelease}
          onChange={onChange}
          onReset={onReset}
          pin={pin}
        />
      </Suspense>
    ),
  }
}
