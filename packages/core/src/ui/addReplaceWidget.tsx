import { wrappedComponent } from '../PluginManager.ts'
import { matchTrackId } from '../util/matchTrackId.ts'

import type PluginManager from '../PluginManager.ts'
import type { ReplaceWidgetProps } from '../PluginManager.ts'
import type { ComponentType } from 'react'

/**
 * Which widgets a `Core-replaceWidget` contribution applies to. Every field
 * given must match, and an empty selector matches every widget — the point
 * fires for all of them, so a contribution with no selector really does take
 * over the drawer, the modal, and every feature detail panel.
 */
// #region selector
export interface WidgetSelector {
  /** widget model type, e.g. `'AlignmentsFeatureWidget'` */
  widgetType?: string | string[]
  /** track type, e.g. `'VariantTrack'`, usually what "for my tracks" means */
  trackType?: string | string[]
  /** track id; a plain string also matches the user's copies of that track */
  trackId?: string | RegExp | (string | RegExp)[]
  /** escape hatch for anything the fields above cannot express */
  where?: (props: ReplaceWidgetProps) => boolean
}
// #endregion

// "Copy track" appends `-${Date.now()}` to the trackId (copyTrackSnapshot), and
// copying a copy appends again, so a bare id in a selector means "this track,
// including the user's copies of it". Doing this in the framework is the point:
// scoping by `trackId ===` is the documented recipe and it silently stops
// applying the moment a user copies the track.
function matchesTrackId(
  trackId: string | undefined,
  pattern: string | RegExp,
): boolean {
  return typeof pattern === 'string'
    ? trackId === pattern ||
        (trackId?.startsWith(`${pattern}-`) === true &&
          trackId
            .slice(pattern.length + 1)
            .split('-')
            .every(part => /^\d+$/.test(part)))
    : matchTrackId(trackId, [pattern])
}

function matchesOneOf(value: string | undefined, expected: string | string[]) {
  return typeof expected === 'string'
    ? value === expected
    : expected.includes(value ?? '')
}

/** Whether `props` satisfies every field of `select`. */
export function widgetSelectorMatches(
  select: WidgetSelector | undefined,
  props: ReplaceWidgetProps,
) {
  const { widgetType, trackType, trackId, where } = select ?? {}
  const { model } = props
  return (
    (widgetType === undefined || matchesOneOf(model.type, widgetType)) &&
    (trackType === undefined || matchesOneOf(model.trackType, trackType)) &&
    (trackId === undefined ||
      (Array.isArray(trackId) ? trackId : [trackId]).some(pattern =>
        matchesTrackId(model.trackId, pattern),
      )) &&
    (where === undefined || where(props))
  )
}

/**
 * Render `component` *instead of* the widget the selector matches.
 *
 * Prefer this to calling `addToExtensionPoint('Core-replaceWidget', ...)`
 * directly: the point fires for every widget that opens, so a hand-written
 * callback has to re-derive the "is this mine, otherwise pass the accumulated
 * component through" logic, and getting either half wrong takes out unrelated
 * widgets.
 *
 * To *add to* the default rather than replace it, use
 * {@link addWidgetWrapper} — do not render the default from inside a component
 * declared in the callback.
 */
export function addReplaceWidget(
  pluginManager: PluginManager,
  {
    select,
    component,
  }: {
    select?: WidgetSelector
    component: ComponentType<ReplaceWidgetProps>
  },
) {
  pluginManager.addToExtensionPoint(
    'Core-replaceWidget',
    (accumulated, props) =>
      widgetSelectorMatches(select, props) ? component : accumulated,
  )
}

export interface WidgetWrapperProps extends ReplaceWidgetProps {
  /** the widget being wrapped; render it where you want it to appear */
  DefaultWidget: ComponentType<ReplaceWidgetProps>
}

/**
 * Render the matched widget inside `wrapper`, which receives it as
 * `DefaultWidget` alongside the widget's own props. Wrappers from several
 * plugins nest rather than clobbering one another.
 *
 * This exists because the obvious hand-written version is broken in a way that
 * is hard to attribute: `Core-replaceWidget` is re-evaluated on every render of
 * the drawer, so a callback that declares its wrapper inline hands React a new
 * component type each time and the widget inside is unmounted and remounted,
 * losing scroll position, form state, and any open sub-panel. Here the wrapped
 * component is built once per wrapped component and cached.
 */
export function addWidgetWrapper(
  pluginManager: PluginManager,
  {
    select,
    wrapper,
  }: {
    select?: WidgetSelector
    wrapper: ComponentType<WidgetWrapperProps>
  },
) {
  const Wrapper = wrapper
  const cache = new WeakMap<
    ComponentType<ReplaceWidgetProps>,
    ComponentType<ReplaceWidgetProps>
  >()
  pluginManager.addToExtensionPoint(
    'Core-replaceWidget',
    (accumulated, props) => {
      let result = accumulated
      if (widgetSelectorMatches(select, props)) {
        const cached = cache.get(accumulated)
        if (cached) {
          result = cached
        } else {
          const built = (widgetProps: ReplaceWidgetProps) => (
            <Wrapper {...widgetProps} DefaultWidget={accumulated} />
          )
          built.displayName = `${Wrapper.displayName ?? Wrapper.name}(${
            accumulated.displayName ?? accumulated.name
          })`
          // records what it wraps, so evaluateComponentExtensionPoint counts
          // this as composition rather than as taking the slot
          Object.defineProperty(built, wrappedComponent, { value: accumulated })
          cache.set(accumulated, built)
          result = built
        }
      }
      return result
    },
  )
}
