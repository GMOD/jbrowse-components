/**
 * The field a feature's name reads as a `featureField`: its name, else its ID,
 * written out so a config and its editor show what runs. A label line, a gene
 * color and its key read it.
 */
export const FEATURE_NAME_FIELD = `jexl:get(feature,'name') || get(feature,'id')`
