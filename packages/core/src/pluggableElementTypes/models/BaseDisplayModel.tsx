import { hasParent, isAlive, types } from '@jbrowse/mobx-state-tree'

import {
  getConf,
  isConfigurationSlot,
  preProcessSlotValues,
} from '../../configuration/index.ts'
import {
  getContainingTrack,
  getEnv,
  statusFraction,
  statusMessageText,
} from '../../util/index.ts'
import { ElementId } from '../../util/types/mst.ts'

import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type { MenuItem } from '../../ui/index.ts'
import type { RpcStatus } from '../../util/progress.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type React from 'react'

/**
 * #stateModel BaseDisplay
 * #category display
 */
function stateModelFactory() {
  return types
    .model('BaseDisplay', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.string,
    })
    .volatile(() => ({
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      error: undefined as unknown,
      statusMessage: undefined as string | undefined,
      /**
       * #volatile
       * determinate progress fraction [0,1] for the current status, or
       * undefined when the in-flight phase is indeterminate. Set alongside
       * `statusMessage` by `setStatusMessage`; a display that never shows a
       * bar simply leaves it undefined.
       */
      statusProgress: undefined as number | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get parentTrack() {
        if (!hasParent(self)) {
          console.warn(
            `[BaseDisplayModel] parentTrack accessed with no parent: alive=${isAlive(self)} type=${self.type}`,
          )
        }
        return getContainingTrack(self)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get RenderingComponent(): React.FC<{
        model: typeof self
        onHorizontalScroll?: (distance: number) => void
        blockState?: Record<string, unknown>
      }> {
        const { pluginManager } = getEnv(self)
        return pluginManager.getDisplayType(self.type)
          .ReactComponent as React.FC<{
          model: typeof self
          onHorizontalScroll?: (distance: number) => void
          blockState?: Record<string, unknown>
        }>
      },

      /**
       * #getter
       */
      get DisplayBlurb(): React.FC<{ model: typeof self }> | null {
        return null
      },

      /**
       * #getter
       */
      get adapterConfig(): Record<string, unknown> {
        // `Record<string, unknown>` is as narrow as this can honestly get: which
        // adapter a track uses is open-ended, so the *contents* are
        // unpredictable. The *shape* is not, and that is the part worth
        // declaring. Leaving it to infer `getConf`'s `any` was the status quo and
        // it propagated: every consumer's RPC arg and adapter spec takes
        // `Record<string, unknown>`, so they accepted whatever they were handed,
        // and two displays re-declared this getter locally just to annotate it.
        //
        // Not `| undefined` — see `BaseTrackModel.adapterConfig` for the probe
        // showing the slot always materializes an object.
        //
        // This is a snapshot, so read a specific slot with an array path off the
        // live node (`getConf(track, ['adapter', 'x'])`) rather than off this —
        // `types.stripDefault` omits a slot at its default. See
        // ../../configuration/CLAUDE.md.
        return getConf(self.parentTrack, 'adapter')
      },

      /**
       * #getter
       * Returns true if the parent track is minimized. Used to skip
       * expensive operations like autoruns when track is not visible.
       */
      get isMinimized() {
        return self.parentTrack.minimized
      },

      /**
       * #getter
       * Overridable hook (default `undefined`): what the pointer is currently
       * over, for readers **outside** the display. `LinearGenomeViewContainer`
       * publishes it to `session.hovered`, the view-wide "what is the user
       * pointing at" channel a plugin can subscribe to.
       *
       * Declared here because a cross-display consumer can only read a name the
       * base declares — the same reason `SyntenyFetchStateMixin.fetchInert` is a
       * hook rather than a getter each display invents. The container used to
       * read `featureUnderMouse`, which only the wiggle, alignments and
       * Manhattan families spelled that way — canvas said `hoveredFeature`,
       * variants `hoveredGenotype` — so the channel carried a hover from a third
       * of the display types and nothing said which. It also asked only
       * `displays[0]` of each track.
       *
       * `unknown` because the payload genuinely differs — a read, a wiggle bin,
       * a SNP, a genotype cell — and `session.hovered` is typed to match ("can
       * be anything; code that wants to deal with this should examine it").
       * Narrow it in the override.
       */
      get hoveredFeature(): unknown {
        return undefined
      },

      /**
       * #getter
       * Overridable hook (default `'feature'`): the SINGULAR word for one of
       * the things this display draws, as a menu row or a chip says it —
       * "Hide this read", "Showing 3 variants".
       *
       * Declared here for the same reason as `hoveredFeature` above: it is read
       * across the display boundary, by chrome that has no idea which display
       * it is drawing for (`SoloSelectionChip`, alignments' group-label
       * overlay), and a name only the base declares is a name every such
       * consumer can rely on. Two displays declared it independently and one of
       * those declarations WAS this default.
       *
       * **A control keeps the generic word; content takes this one.** "Variant
       * height" reads as a different setting from "Feature height" when it is
       * the same one, so the shared menus stay on "feature" however the display
       * answers here, and the noun varies where it names what the user is
       * looking at — "Showing 3 variants", "Hide this read". A display drawing
       * something the generic word already fits is right to leave this alone.
       *
       * Distinct from the per-hit noun a context menu takes off the clicked
       * item's own `type` ("mRNA", "gene"); that names one annotation, this
       * names what the track holds. The hit noun falls back to this.
       */
      get featureNoun(): string {
        return 'feature'
      },

      /**
       * #getter
       * Overridable hook: which widget `openFeatureWidget` opens for one of
       * this display's features. The default is the generic one, which is what
       * a display drawing plain features wants and what the canvas base spelled
       * out by hand.
       *
       * An override is a display whose features have a vocabulary of their own —
       * a read, a variant, a synteny block — and the `id` is deliberately part
       * of it: two displays naming one id share the drawer panel, which is the
       * behaviour when the two are showing the same kind of thing.
       */
      get featureWidgetType(): { type: string; id: string } {
        return {
          type: 'BaseFeatureWidget',
          id: 'baseFeature',
        }
      },
    }))
    .views(self => ({
      /**
       * #method
       * props passed to the renderer's React "Rendering" component.
       * these are client-side only and never sent to the worker.
       * includes displayModel and callbacks
       */
      renderingProps() {
        return {
          displayModel: self,
        }
      },

      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        return []
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setStatusMessage(status?: RpcStatus) {
        // derive the indeterminate label and the determinate fraction from the
        // one status transport; displays with no bar just ignore statusProgress
        self.statusMessage = statusMessageText(status)
        self.statusProgress = statusFraction(status)
      },
      /**
       * #action
       */
      setError(error?: unknown) {
        self.error = error
      },
      /**
       * #action
       * Overridable hook (default no-op): drop whatever `hoveredFeature`
       * reports. The writing twin of that getter, and what
       * `installClearHoverOnViewportChange` calls.
       *
       * A display that STORES its hover owes an override; one that derives it
       * from the live pointer (MAF, Hi-C, LD) owes nothing, and the default
       * costs it nothing. Declared here so the clear can be installed for every
       * display rather than remembered per display — forgetting it is the
       * failure ARCHITECTURE.md's stored-hover section is about, and it used to
       * be six closures at six call sites, which is six chances to omit one.
       */
      clearHoveredFeature() {},

      /**
       * #action
       * base display reload does nothing, see specialized displays for details
       */
      reload() {},

      /**
       * #action
       * Apply a bag of display settings to the LIVE display, and report what
       * landed. Each key runs through the display config schema's
       * `preProcessSnapshot` (shorthand expansions, legacy-key migrations —
       * the same lowering a session spec's inline track keys get in
       * `showTrackGeneric`), then writes the matching config slot. Keys that
       * are not slots come back in `unapplied` rather than vanishing: the
       * settings vocabulary's historical failure mode is the silently dropped
       * key.
       *
       * `allowSetters` additionally routes a non-slot key to a conventionally
       * named single-argument `set<Key>` action. Opt-in, never the default:
       * the declarative surfaces (session specs, share links, embeds) feed
       * this whole bags of untyped JSON, and a blanket fallback would let
       * them reach internal setters (`setError`, `setScrollTop`, ...) and
       * call multi-argument setters with one argument. A caller that wants a
       * specific action can also simply call it.
       *
       * Per-key errors land in `unapplied` instead of aborting the rest of
       * the bag — a caller mid-`showTrack` has already pushed the track, and
       * one rejected value must not strand a half-configured track.
       */
      applyDisplaySettings(
        settings: Record<string, unknown>,
        options?: { allowSetters?: boolean },
      ) {
        // configuration is the reference every concrete display adds at
        // instantiation (see DisplayModel below); the base model composes
        // before it exists, hence the cast rather than a prop
        const { configuration } = self as unknown as DisplayModel
        const applied: string[] = []
        const unapplied: string[] = []
        const slots = preProcessSlotValues(configuration, settings)
        for (const [key, value] of Object.entries(slots)) {
          if (!key || key === 'type') {
            unapplied.push(
              key ? 'type (switch the display type instead)' : '(empty key)',
            )
            continue
          }
          try {
            if (isConfigurationSlot(configuration, key)) {
              // the key arrives from runtime JSON; setConf's slot name is a
              // compile-time type
              // eslint-disable-next-line no-restricted-syntax
              configuration.setSlot(key, value)
              applied.push(key)
              continue
            }
            const setter = (self as unknown as Record<string, unknown>)[
              `set${key[0]!.toUpperCase()}${key.slice(1)}`
            ]
            if (typeof setter !== 'function') {
              unapplied.push(key)
            } else if (options?.allowSetters) {
              ;(setter as (value: unknown) => void)(value)
              applied.push(`${key} (via setter)`)
            } else {
              unapplied.push(
                `${key} (not a config slot; a set${key[0]!.toUpperCase()}${key.slice(1)} action exists — call it, or pass { allowSetters: true })`,
              )
            }
          } catch (e) {
            unapplied.push(`${key} (${e})`)
          }
        }
        return { applied, unapplied }
      },
    }))
}

export const BaseDisplay = stateModelFactory()
export type BaseDisplayStateModel = typeof BaseDisplay
export type BaseDisplayModel = Instance<BaseDisplayStateModel>

/**
 * The shape every display instance held in a track's `displays` array
 * satisfies: the composed `BaseDisplay` state model (RenderingComponent,
 * DisplayBlurb, trackMenuItems, ...) plus the `configuration`
 * reference every display gains at instantiation. `getPortableSettings` is
 * optional — only display types that support switching type via the track menu
 * implement it. This is the concrete element type behind
 * `BaseTrackModel.displays`, which the runtime plugin union erases to `any`.
 */
export interface DisplayModel extends BaseDisplayModel {
  configuration: AnyConfigurationModel & { displayId: string }
  getPortableSettings?: (
    newDisplayId?: string,
  ) => Record<string, unknown> | undefined
}
