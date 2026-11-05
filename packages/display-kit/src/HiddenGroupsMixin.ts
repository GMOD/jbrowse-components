import { getConf, setConf } from '@jbrowse/core/configuration'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export const NO_HIDDEN_GROUPS: ReadonlySet<string> = new Set()

/** The whole of what `HiddenGroupsMixin` needs a composing display to be. */
export interface GroupKeySpaceHost {
  groupKeySpace: string
  configuration: AnyConfigurationModel
}

// The mixin's own `self` is the model it declares, so it cannot see the
// `groupKeySpace` getter or the config the concrete display supplies. Same
// idiom as `LegendMixin`'s `confNode`.
const keySpaceHost = (self: object) => self as GroupKeySpaceHost

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
      const { groupKeySpace } = self
      if (
        !groupKeySpace ||
        groupKeySpace !== getConf(self, ['facet', 'field'])
      ) {
        return NO_HIDDEN_GROUPS
      }
      const hidden: readonly string[] = getConf(self, ['facet', 'hidden'])
      return hidden.length > 0 ? new Set(hidden) : NO_HIDDEN_GROUPS
    },
  }
}

/**
 * #stateModel HiddenGroupsMixin
 * #category display
 * #crossCuttingMixin The sections a reader hid from an in-track grouping's chips: the `facet.hidden` keys while the stack groups by the facet's field, `hideGroup` and `showAllGroups` writing them, `hiddenGroups` reading them, `groupStateKey` (with the `ownGroupState` hook) for a live figure to key on, and the `dropGroupState` reset that fires when the host's `groupKeySpace` moves
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
       * Drop a section from the stack. Reversed by `showAllGroups`, which
       * the "Show" menu offers while anything is hidden, since a hidden
       * section has no chip to restore it.
       */
      hideGroup(key: string) {
        if (!self.hiddenGroups.has(key)) {
          setConf(
            keySpaceHost(self),
            ['facet', 'hidden'],
            [...self.hiddenGroups, key],
          )
        }
      },
      /**
       * #action
       */
      showAllGroups() {
        setConf(keySpaceHost(self), ['facet', 'hidden'], [])
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
