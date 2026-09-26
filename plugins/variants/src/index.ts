import Plugin from '@jbrowse/core/Plugin'

import LDDisplayF from './LDDisplay/index.ts'
import LDTrackF from './LDTrack/index.ts'
import LinearMultiSampleVariantDisplayF from './LinearMultiSampleVariantDisplay/index.ts'
import LinearVariantDisplayF from './LinearVariantDisplay/index.ts'
import PlinkLDAdapterF from './PlinkLDAdapter/index.ts'
import LDDataRPCMethodsF from './RenderLDDataRPC/index.ts'
import SplitVcfTabixAdapterF from './SplitVcfTabixAdapter/index.ts'
import VariantFeatureWidgetF from './VariantFeatureWidget/index.ts'
import { MultiSampleVariantClusterGenotypeMatrix } from './VariantRPC/MultiSampleVariantClusterGenotypeMatrix.ts'
import { MultiSampleVariantGetCellData } from './VariantRPC/MultiSampleVariantGetCellData.ts'
import { MultiSampleVariantGetGenotypeMatrix } from './VariantRPC/MultiSampleVariantGetGenotypeMatrix.ts'
import { MultiSampleVariantGetSources } from './VariantRPC/MultiSampleVariantGetSources.ts'
import VariantTrackF from './VariantTrack/index.ts'
import VcfAdapterF from './VcfAdapter/index.ts'
import VcfTabixAdapterF from './VcfTabixAdapter/index.ts'
import { getAlleleLength } from './shared/alleleLength.ts'
import {
  getAltAlleleCount,
  getGenotypeClassCount,
} from './shared/genotypeClassCounts.ts'
import {
  featureMinorAlleleFrequency,
  featureMissingness,
} from './shared/minorAlleleFrequencyUtils.ts'
import {
  getVariantConsequence,
  getVariantConsequences,
  getVariantImpact,
  getVariantImpactColor,
} from './shared/variantConsequence.ts'
import {
  getVariantSvType,
  getVariantSvTypeColor,
} from './shared/variantSvType.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class VariantsPlugin extends Plugin {
  name = 'VariantsPlugin'

  install(pluginManager: PluginManager) {
    VcfAdapterF(pluginManager)
    VcfTabixAdapterF(pluginManager)
    SplitVcfTabixAdapterF(pluginManager)
    PlinkLDAdapterF(pluginManager)
    VariantFeatureWidgetF(pluginManager)
    VariantTrackF(pluginManager)
    LDTrackF(pluginManager)
    LinearVariantDisplayF(pluginManager)
    LinearMultiSampleVariantDisplayF(pluginManager)
    LDDisplayF(pluginManager)
    LDDataRPCMethodsF(pluginManager)

    pluginManager.addRpcMethod(
      () => new MultiSampleVariantGetSources(pluginManager),
    )
    pluginManager.addRpcMethod(
      () => new MultiSampleVariantGetGenotypeMatrix(pluginManager),
    )
    pluginManager.addRpcMethod(
      () => new MultiSampleVariantClusterGenotypeMatrix(pluginManager),
    )
    pluginManager.addRpcMethod(
      () => new MultiSampleVariantGetCellData(pluginManager),
    )
  }

  configure(pluginManager: PluginManager) {
    const { jexl } = pluginManager

    /** #jexlFunction Variant functions | maf(feature) | minor allele frequency over the called alleles */
    jexl.addFunction('maf', featureMinorAlleleFrequency)
    /** #jexlFunction Variant functions | missingness(feature) | fraction of alleles with no call, so ./1 counts half */
    jexl.addFunction('missingness', featureMissingness)

    // Variant-consequence helpers, reading SnpEff ANN / VEP CSQ. `impact` and
    // `consequence` return strings for custom color-by-attribute expressions
    // (e.g. jexl:randomColor(consequence(feature))); `impactColor` powers the
    // one-click "Color by consequence impact" menu item.
    /** #jexlFunction Variant functions | impact(feature) | HIGH, MODERATE, LOW or MODIFIER, from SnpEff ANN / VEP CSQ */
    jexl.addFunction('impact', getVariantImpact)
    /** #jexlFunction Variant functions | consequence(feature) | e.g. missense_variant, from the same annotation — the MOST SEVERE one alone */
    jexl.addFunction('consequence', getVariantConsequence)
    /** #jexlFunction Variant functions | 'missense_variant' in consequences(feature) | every consequence term on the record, across all transcripts (bcftools INFO/CSQ ~ "missense_variant") */
    jexl.addFunction('consequences', getVariantConsequences)
    /** #jexlFunction Variant functions | impactColor(feature) | the color the "Color by consequence impact" menu item uses */
    jexl.addFunction('impactColor', getVariantImpactColor)
    // `svTypeColor` powers the one-click "Color by SV type" menu item on the
    // single-variant display (fixed class colors + copy-number rainbow).
    /** #jexlFunction Variant functions | svTypeColor(feature) | the color "Color by SV type" uses */
    jexl.addFunction('svTypeColor', getVariantSvTypeColor)
    // Longest allele in bp, so a filter can select the SV tier of a decomposed
    // pangenome callset (`jexl:alleleLength(feature) >= 50`) without missing
    // insertions, which consume no reference and so have a span of 1.
    /** #jexlFunction Variant functions | alleleLength(feature) >= 50 | longest allele in bp, so an insertion is not measured by its reference span */
    jexl.addFunction('alleleLength', getAlleleLength)
    // The three below round out the bcftools filtering vocabulary a VCF track
    // is expected to speak (#939): its INFO/QUAL/FILTER expressions already
    // transliterate through plain member access, and these are the derived
    // quantities that have no field to read.
    /** #jexlFunction Variant functions | svType(feature) == 'DEL' | SV class, read off a symbolic ALT before falling back to INFO/SVTYPE (bcftools INFO/SVTYPE) */
    jexl.addFunction('svType', getVariantSvType)
    /** #jexlFunction Variant functions | nAlt(feature) == 1 | ALT alleles the record declares, i.e. biallelic-only (bcftools N_ALT) */
    jexl.addFunction('nAlt', getAltAlleleCount)
    /** #jexlFunction Variant functions | genotypeCount(feature, 'het') > 0 | samples in a genotype class — ref, alt, hom, het or mis (bcftools N_PASS(GT="het")) */
    jexl.addFunction('genotypeCount', getGenotypeClassCount)
  }
}

export { default as VcfFeature } from './VcfFeature/index.ts'

// The SV-type color scheme, for the other plugins that paint the same callset:
// the SV inspector's chords read it so a chord and a variant cell agree on what
// a deletion looks like, and it carries the legend's labels and order with it
export {
  PREDEFINED_SV_TYPES,
  getSvTypeColor,
  getVariantSvType,
  svTypeDisplayLabel,
  svTypeFromToken,
} from './shared/variantSvType.ts'

export type { LinearVariantDisplayModel } from './LinearVariantDisplay/model.ts'
export type { LinearMultiSampleVariantDisplayModel } from './LinearMultiSampleVariantDisplay/model.ts'
