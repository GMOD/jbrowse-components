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
 * #stateModel HiddenGroupsMixin
 * #category display
 * #crossCuttingMixin The sections a reader hid from an in-track grouping's chips: the `facet.hidden` keys while the stack groups by the facet's own field, `hideGroup` and `showAllGroups` writing them, the `displayHiddenGroupKeys` hook a display hides a lane through on its own behalf, `hiddenGroupKeys` folding both, `groupStateKey` (with the `ownGroupState` hook) for a live figure to key on, and the `dropGroupState` reset that fires when the host's `groupKeySpace` moves
 *
 * The hidden sections are config, `facet.hidden`, so they ride a session and
 * a share link, and a new `field` written whole starts with none. A key names
 * a section only within the grouping that issued it, `''` being both the
 * ungrouped section and every field's catch-all, so they apply only while
 * the stack groups by `facet.field`: where a mode degrades the grouping (an
 * alignments chain beside a per-read facet) they wait unread. A display
 * keeping volatile per-group state of its own overrides `dropGroupState`,
 * which the reset calls.
 */
export default function HiddenGroupsMixin() {
  return types
    .model('HiddenGroupsMixin', {})
    .views(() => ({
      /**
       * #getter
       * Overridable hook: lanes the DISPLAY hides on its own behalf, as
       * opposed to the ones the user hid from a chip. Empty by default;
       * LGVSyntenyDisplay hides the self-alignment lane of an all-vs-all
       * track through it.
       */
      get displayHiddenGroupKeys(): ReadonlySet<string> {
        return NO_HIDDEN_GROUPS
      },
      /**
       * #getter
       * Overridable hook: the per-group state a display keeps beyond the
       * hidden sections, as a plain value. None by default; alignments
       * answers its collapses and height overrides, the state its
       * `dropGroupState` clears.
       */
      get ownGroupState(): unknown {
        return undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The sections the user hid: `facet.hidden`, while the stack groups by
       * the facet's own field.
       */
      get hiddenGroups(): ReadonlySet<string> {
        const host = keySpaceHost(self)
        const { groupKeySpace } = host
        if (
          !groupKeySpace ||
          groupKeySpace !== getConf(host, ['facet', 'field'])
        ) {
          return NO_HIDDEN_GROUPS
        }
        const hidden: readonly string[] = getConf(host, ['facet', 'hidden'])
        return hidden.length > 0 ? new Set(hidden) : NO_HIDDEN_GROUPS
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Every key the stack drops: what the user hid and what the display
       * hides for itself. A fresh Set per change, so a layout memo comparing
       * its inputs by identity sees a hide.
       */
      get hiddenGroupKeys(): ReadonlySet<string> {
        const own = self.displayHiddenGroupKeys
        return self.hiddenGroups.size === 0
          ? own
          : new Set([...own, ...self.hiddenGroups])
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
          [...this.hiddenGroupKeys].sort((a, b) => a.localeCompare(b)),
          self.ownGroupState,
        ]
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Drop a section from the stack. Reversed by `showAllGroups`, which
       * the "Show..." menu offers while anything is hidden, since a hidden
       * section draws no chip of its own to come back from.
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
       * keeps. Nothing by default, since the hidden sections are config.
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
