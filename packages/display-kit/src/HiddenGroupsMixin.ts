import { readConfObject, setConf } from '@jbrowse/core/configuration'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

import type { sectionFacetConfigSchema } from './sectionFacetConfigSchema.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'

export const NO_HIDDEN_GROUPS: ReadonlySet<string> = new Set()

/**
 * A config node holding a section facet: a display's own configuration, or a
 * band's within it, such as the variant display's `records`.
 */
export type SectionFacetOwner = ConfigModelForFields<{
  facet: typeof sectionFacetConfigSchema
}>

/** The whole of what `HiddenGroupsMixin` needs a composing display to be. */
export interface GroupKeySpaceHost {
  groupKeySpace: string
  configuration: SectionFacetOwner
}

// The mixin's own `self` is the model it declares, so it cannot see the
// `groupKeySpace` getter or the config the concrete display supplies. Same
// idiom as `LegendMixin`'s `confNode`.
const keySpaceHost = (self: object) => self as GroupKeySpaceHost

/**
 * `owner`'s `facet.hidden`, while `groupKeySpace` is the facet's field: a key
 * names a section only within the grouping that issued it, so a hidden list
 * written beside no field, or another, hides nothing. A fresh Set per call.
 */
export function hiddenGroupsOf(
  owner: SectionFacetOwner,
  groupKeySpace: string,
): ReadonlySet<string> {
  const hidden =
    groupKeySpace && groupKeySpace === readConfObject(owner, ['facet', 'field'])
      ? readConfObject(owner, ['facet', 'hidden'])
      : []
  return hidden.length > 0 ? new Set(hidden) : NO_HIDDEN_GROUPS
}

/** `HiddenGroupsMixin`'s `setHiddenGroups` over `owner`'s facet. */
export function setHiddenGroupsOn(
  owner: SectionFacetOwner,
  keys: readonly string[],
) {
  setConf(owner, ['facet', 'hidden'], [...new Set(keys)])
}

/**
 * The sections hidden off `facet.hidden`, which `HiddenGroupsMixin` installs
 * and a static host composes beside its config node.
 */
export function hiddenGroupsViews(self: GroupKeySpaceHost) {
  return {
    /**
     * #getter
     * The sections the user hid: `facet.hidden`, while the stack groups by
     * the facet's field. A fresh Set per change, so a layout memo comparing
     * its inputs by identity sees a hide.
     */
    get hiddenGroups(): ReadonlySet<string> {
      return hiddenGroupsOf(self.configuration, self.groupKeySpace)
    },
  }
}

/**
 * #stateModel HiddenGroupsMixin
 * #category display
 * #crossCuttingMixin The sections a reader hid from an in-track grouping's chips: the `facet.hidden` keys while the stack groups by the facet's field, `setHiddenGroups`, `hideGroup` and `showAllGroups` writing them, `hiddenGroups` reading them, `groupStateKey` (with the `ownGroupState` hook) for a live figure to key on, and the `dropGroupState` reset that fires when the host's `groupKeySpace` moves
 *
 * The hidden sections are config, `facet.hidden`, so they ride a session and
 * a share link, and a new `field` written whole starts with none. A key names
 * a section only within the grouping that issued it, `''` being both the
 * ungrouped section and every field's catch-all, so they apply only while
 * the stack groups by `facet.field`: where a mode degrades the grouping (an
 * alignments chain beside a per-read facet) they wait unread. A display
 * that keeps volatile per-group state overrides `dropGroupState`,
 * which the reset calls.
 */
export default function HiddenGroupsMixin() {
  return types
    .model('HiddenGroupsMixin', {})
    .views(() => ({
      /**
       * #getter
       * Overridable hook: the per-group state a display keeps beyond the
       * hidden sections, as a plain value. `undefined` by default; alignments
       * returns its collapses and height overrides, the state its
       * `dropGroupState` clears.
       */
      get ownGroupState(): unknown {
        return undefined
      },
    }))
    .views(self => hiddenGroupsViews(keySpaceHost(self)))
    .views(self => ({
      /**
       * #getter
       * Read `hiddenGroups`, which this returns
       * @deprecated
       */
      get hiddenGroupKeys(): ReadonlySet<string> {
        return self.hiddenGroups
      },
      /**
       * #getter
       * All the per-group state as a plain, comparable value: the hidden
       * sections, sorted, beside `ownGroupState`. A live figure keys on it,
       * since a display's own state is volatile and in no snapshot; a Set
       * would serialize as `{}`.
       */
      get groupStateKey(): unknown {
        return [
          [...self.hiddenGroups].sort((a, b) => a.localeCompare(b)),
          self.ownGroupState,
        ]
      },
    }))
    .actions(self => ({
      /**
       * #action
       * The whole hidden set at once.
       */
      setHiddenGroups(keys: readonly string[]) {
        setHiddenGroupsOn(keySpaceHost(self).configuration, keys)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Drop a section from the stack. Reversed by `showAllGroups`, which
       * the "Show" menu offers while anything is hidden, since a hidden
       * section has no chip to restore it.
       */
      hideGroup(key: string) {
        if (!self.hiddenGroups.has(key)) {
          self.setHiddenGroups([...self.hiddenGroups, key])
        }
      },
      /**
       * #action
       */
      showAllGroups() {
        self.setHiddenGroups([])
      },
      /**
       * #action
       * Overridable hook: forget the volatile per-group state a display
       * keeps. A no-op by default, since the hidden sections are config.
       */
      dropGroupState() {},
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          reaction(
            () => keySpaceHost(self).groupKeySpace,
            () => {
              self.dropGroupState()
            },
            { name: 'GroupKeySpaceReset' },
          ),
        )
      },
    }))
}
