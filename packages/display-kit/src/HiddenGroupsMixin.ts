import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { observable, reaction } from 'mobx'

export const NO_HIDDEN_GROUPS: ReadonlySet<string> = new Set()

/** The whole of what `HiddenGroupsMixin` needs a composing display to be. */
export interface GroupKeySpaceHost {
  groupKeySpace: string
}

// The mixin's own `self` is the model it declares, so it cannot see the
// `groupKeySpace` getter the concrete display supplies. Same idiom as
// `LegendMixin`'s `confNode`.
const keySpaceHost = (self: object) => self as GroupKeySpaceHost

/**
 * #stateModel HiddenGroupsMixin
 * #category display
 * #crossCuttingMixin The sections a reader hid from an in-track grouping's chips: the `hiddenGroups` set, `hideGroup` and `showAllGroups` over it, the `displayHiddenGroupKeys` hook a display hides a lane through on its own behalf, `hiddenGroupKeys` folding both, and the `dropGroupState` reset that fires when the host's `groupKeySpace` moves
 *
 * A key names a section only within the grouping that issued it: `''` is both
 * the ungrouped section and every dimension's catch-all, and two dimensions'
 * digit keys overlap outright. So the state is volatile and dropped whenever
 * `groupKeySpace` changes, whichever route moved it: the menu, the settings
 * editor writing the slot, a reset, or a mode that degrades the grouping. A
 * display keeping more per-group state overrides `dropGroupState` and calls
 * through.
 */
export default function HiddenGroupsMixin() {
  return types
    .model('HiddenGroupsMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * Group keys the user hid from the stack.
       */
      hiddenGroups: observable.set<string>(),
    }))
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
    }))
    .views(self => ({
      /**
       * #getter
       * Every key the stack drops: what the user hid and what the display
       * hides for itself. A fresh Set per change rather than the observable
       * set itself, so a layout memo comparing its inputs by identity sees a
       * hide.
       */
      get hiddenGroupKeys(): ReadonlySet<string> {
        const own = self.displayHiddenGroupKeys
        return self.hiddenGroups.size === 0
          ? own
          : new Set([...own, ...self.hiddenGroups])
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
        self.hiddenGroups.add(key)
      },
      /**
       * #action
       */
      showAllGroups() {
        self.hiddenGroups.clear()
      },
      /**
       * #action
       * Forget every hidden section.
       */
      dropGroupState() {
        self.hiddenGroups.clear()
      },
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
