import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BaseLinearDisplay
 * #category display
 *
 * Shared base config for linear displays — its slots (`height`,
 * `maxFeatureScreenDensity`, `fetchSizeLimit`, `mouseover`, `jexlFilters`) are
 * common to all of them. The GPU stack's `LinearCanvasBaseDisplay` config
 * extends it, and third-party plugins extend it too.
 */

const baseLinearDisplayConfigSchema = ConfigurationSchema(
  'BaseLinearDisplay',
  {
    // Not a fallback for the byte gate: the two axes run together on every
    // canvas fetch, and this is the one that catches what bytes structurally
    // cannot. An index size can't tell "a few large features" from "many tiny
    // ones" — a dense VCF is small on disk and still has more variants than
    // there are pixels to draw them in.
    /**
     * #slot
     */
    maxFeatureScreenDensity: {
      type: 'number',
      description:
        'maximum features per pixel before showing a "too many features" message',
      defaultValue: 1,
      advanced: true,
    },
    /**
     * #slot
     */
    // Conservative 1MB floor for the base display; the byte gate prefers an
    // adapter-declared fetchSizeLimit over this (resolveByteLimit), so it only
    // bites adapters that declare none. LinearBasicDisplay raises it to 5MB for
    // feature tracks.
    fetchSizeLimit: {
      type: 'number',
      defaultValue: 1_000_000,
      description:
        "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
      advanced: true,
    },
    /**
     * #slot
     * Declarative equivalent of the "Force load" button on the "too much data"
     * banner: when true the display always renders, however large the region or
     * dense the features. Off by default (the gate guards against huge
     * downloads). Set it on a view no one can interact with — an embedded /
     * notebook view, or a screenshot — where the region is known and you want it
     * drawn without a click.
     */
    forceLoad: {
      type: 'boolean',
      defaultValue: false,
      description:
        'always render regardless of the region-size / feature-density gate (declarative equivalent of the "Force load" button)',
      advanced: true,
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 100,
      description: 'default height for the track',
    },
    /**
     * #slot
     */
    mouseover: {
      type: 'string',
      description: 'text to display when the cursor hovers over a feature',
      // `function` (INSDC/GFF3 qualifier) before the id fallback so hovering a
      // feature with no name — e.g. an NCBI viral `stem_loop` — surfaces its
      // descriptor rather than a bare id. get() since `function` is reserved.
      defaultValue: `jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'function')||get(feature,'id')`,
      contextVariable: ['feature'],
    },
    /**
     * #slot
     * config jexlFilters are deferred evaluated so they are prepended with
     * jexl at runtime rather than being stored with jexl in the config
     */
    jexlFilters: {
      type: 'stringArray',
      description:
        'default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system',
      // EMPTY, and the NCBI source-record rule that used to live here is now
      // `hideSourceFeatures` on the canvas display's own schema, applied in
      // buildFeatureAdmission. This slot seeds the "Filter by..." dialog, so a
      // default here is a jexl expression every user meets on every track
      // before writing one of their own, on a rule that is about one annotation
      // source (reviewer: "it confuses people ... it is just for ncbi gff").
      defaultValue: [],
    },
  },
  {
    /**
     * #identifier
     */
    explicitIdentifier: 'displayId',
  },
)

export default baseLinearDisplayConfigSchema

/**
 * What a mixin reading a base slot asks a composing display's `configuration`
 * to be. Narrow on purpose: `getConf`/`setConf` check a slot name against the
 * schema of the model handed to them, so a mixin reaching its host through
 * `AnyConfigurationModel` gets no check and every name typechecks. See
 * `ConfigModelForFields`, whose `BASE` parameter is the same idea for a mixin
 * that owns a field table as well.
 */
export type BaseLinearDisplayConfigModel = Instance<
  typeof baseLinearDisplayConfigSchema
>
