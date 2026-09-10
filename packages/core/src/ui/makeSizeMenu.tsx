import { Suspense, lazy } from 'react'

import { INLINE_MENU_ROW_WIDTH } from './inlineMenuRowWidth.ts'

import type { MenuItem } from './MenuTypes.ts'
import type { SliderScale } from './sliderScale.ts'

// The row's drawn half is `lazy()` because this builder is called from state
// models and menu modules, which are eager, and the row is the only route by
// which MUI
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

// One inline menu row: the live value/slider with a reset button.
//
// `getValue` is a thunk, read inside `SizeSliderRow`'s own observer, so the
// slider tracks the model while the menu stays open. Not because the built row
// is never rebuilt — `CascadingMenu` calls a `MenuItemsGetter` inside its own
// observer render, so a menu built from a getter does rebuild on the write —
// but because `menuItems` may equally be a plain `MenuItem[]`, which nothing
// rebuilds, and a captured number would then go stale mid-drag.
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
  // prose for the "?" on the SUBMENU row `makeSizeSubMenu` wraps the size row
  // in, the same affordance a checkbox/radio row's `helpText` gets. The size row
  // itself draws none: it is a custom row, so it never reaches the menu's shared
  // trailing column, and inline (`makeSizeMenu`) there is nowhere to put it.
  help?: string
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
// slider/reset behavior can't drift. Pass `scale: 'log'` for values spanning
// orders of magnitude, and `format` to label non-`px` units.
export function makeSizeMenu(
  opts: SizeMenuOptions & { isDefault: boolean },
): MenuItem {
  return sizeMenu(opts, opts.isDefault)
}

// The same control one hop down: a plain submenu row whose only child is the
// size row above.
//
// For a menu where a slider drawn inline is the odd one out. Every other row
// there is `label + [?] + (checkbox | chevron)` and a size row is a two-line
// block with a widget of its own, so a menu holding several reads as a form to
// fill in rather than a list to pick from — and the comparative views' settings
// menus hold three each. Behind a chevron the row shape is uniform top to
// bottom, and the value moves inside next to the slider that sets it, which is
// where the radio submenus already keep their state.
//
// `help` lands on the submenu row, which is the row a reader sees: the size row
// behind the chevron never reaches the menu's shared trailing column, and a "?"
// of its own would only be a second one for the same setting, a hover away.
export function makeSizeSubMenu(
  opts: SizeMenuOptions & { isDefault: boolean },
): MenuItem {
  return {
    label: opts.title,
    helpText: opts.help,
    subMenu: [makeSizeMenu(opts)],
  }
}

function sizeMenu(opts: SizeMenuOptions, isDefault: boolean): MenuItem {
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
        />
      </Suspense>
    ),
  }
}
