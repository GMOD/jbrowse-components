import PluginManager from './PluginManager.ts'
import { addExtensionElement } from './ui/addExtensionElement.tsx'
import { wrapComponent } from './ui/wrapComponent.tsx'

import type {
  ExtensionPointArgs,
  ExtensionPointName,
  FeaturePanelProps,
  ReplaceWidgetProps,
} from './PluginManager.ts'
import type {
  ComponentExtensionPointName,
  PanelProps,
} from './ui/PluggableComponents.tsx'
import type { ElementExtensionPointName } from './ui/addExtensionElement.tsx'
import type { SlotProps, WrapperProps } from './ui/wrapComponent.tsx'
import type { ComponentType, ReactNode } from 'react'

// Which UI seam a point belongs to is DECLARED — `ComponentSlot`,
// `ComponentList`, `ElementList` — and this file pins that the declaration is
// what decides, plus that the props ride along it unwidened. Both are invisible
// failures: a seam that admits the wrong point compiles at every call site, and
// a props type that widened to `object` accepts anything a producer passes.
//
// Typecheck-only. An unused `@ts-expect-error` fails `pnpm typecheck` and an
// `AssertNever` that isn't `never` fails to instantiate, so these assert without
// running. Don't open a line with a directive — TS reads one in any `//`
// comment and it would swallow the next real error.

/** fails to instantiate unless `T` is `never`, which is the assertion */
type AssertNever<T extends never> = T

const pm = new PluginManager([])
const Panel = (_props: FeaturePanelProps) => null
const Widget = (_props: ReplaceWidgetProps) => null

// what PluggableComponents constrains its `name` to
const panelSeam = <N extends ComponentExtensionPointName>(name: N) => name

function shapesAreDeclaredNotSniffed() {
  // @ts-expect-error a guesser is not a component slot, however callable it looks
  wrapComponent(pm, 'Core-guessTrackTypeForLocation', Widget)
  // @ts-expect-error nor is a point that threads a model through
  wrapComponent(pm, 'Core-extendSession', Widget)
  // @ts-expect-error a list of panels is not a slot
  wrapComponent(pm, 'Core-extraFeaturePanel', Panel)
  // @ts-expect-error an overlay accumulates elements, not components
  wrapComponent(pm, 'LinearGenomeView-HighlightSVGComponent', Widget)

  // @ts-expect-error a slot renders one component, so it is not this producer
  panelSeam('Core-replaceWidget')
  // @ts-expect-error an element list is rendered by PluggableElements instead
  panelSeam('LinearGenomeView-HighlightSVGComponent')

  // @ts-expect-error a panel list holds components, which are not ReactNodes
  addExtensionElement(pm, 'Core-extraFeaturePanel', Panel)
  // @ts-expect-error and a slot holds one of them
  addExtensionElement(pm, 'Core-replaceWidget', Widget)
}

// The seams read the props off the registry entry. Widening either to `object`
// keeps every producer and every wrapper compiling, and the point's contract is
// then asserted nowhere.
function propsRideTheShapeUnwidened() {
  wrapComponent(pm, 'Core-replaceWidget', props => {
    // @ts-expect-error the slot's own props reach the wrapper, not a widened bag
    void props.notAWidgetProp
    return props.model.type
  })

  const panelProps: PanelProps<'Core-extraFeaturePanel'> = {
    model: {},
    feature: { uniqueId: 'f1', refName: 'ctgA', start: 0, end: 10 },
    depth: 0,
    // @ts-expect-error the point declares FeaturePanelProps and nothing else
    somethingElse: 1,
  }
  return panelProps
}

// `DefaultComponent` is the slot's own component, so handing it another point's
// props has to fail — that is what makes a wrapper safe to nest.
type SlotIsNotWidened = AssertNever<
  Exclude<SlotProps<'Core-replaceWidget'>, ReplaceWidgetProps>
>
type WrapperCarriesTheDefault = AssertNever<
  Exclude<
    WrapperProps<'Core-replaceWidget'>['DefaultComponent'],
    ComponentType<ReplaceWidgetProps>
  >
>

// The inverse of the seam types, and the check a NEW point needs: declaring one
// the long way rather than as a shape leaves it out of every producer, which
// nothing else notices. Only the array forms are decidable this way — an array
// cannot be mistaken for a function, which is exactly what sinks the singular
// `ComponentSlot` case, so a new slot point has no check but this file.
type UndeclaredElementList = Exclude<
  {
    [N in ExtensionPointName]: ExtensionPointArgs<N> extends ReactNode[]
      ? N
      : never
  }[ExtensionPointName],
  ElementExtensionPointName
>
type UndeclaredComponentList = Exclude<
  {
    [
      N in ExtensionPointName
    ]: ExtensionPointArgs<N> extends ComponentType<never>[] ? N : never
  }[ExtensionPointName],
  ComponentExtensionPointName
>
type EveryElementListDeclaresIt = AssertNever<UndeclaredElementList>
type EveryComponentListDeclaresIt = AssertNever<UndeclaredComponentList>

test('each seam accepts only the points declared for it', () => {
  // the assertions are the directives and AssertNevers above; this keeps jest
  // from reporting the file as empty, and the accepted spellings prove the
  // rejected names are real points rather than typos
  expect(typeof shapesAreDeclaredNotSniffed).toBe('function')
  expect(typeof propsRideTheShapeUnwidened).toBe('function')
  expect(panelSeam('Core-extraFeaturePanel')).toBe('Core-extraFeaturePanel')
  expect(pm.extensionPointCallbackCount('Core-extraFeaturePanel')).toBe(0)
})

export type {
  SlotIsNotWidened,
  WrapperCarriesTheDefault,
  EveryElementListDeclaresIt,
  EveryComponentListDeclaresIt,
}
