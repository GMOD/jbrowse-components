/**
 * The field a feature's name reads as a `featureField`: its name, else its
 * `product`, else its ID, written out so a config and its editor show what
 * runs. A label line, a gene color and its key read it. `product` names an NCBI
 * cleavage product, which has no Name.
 */
export const FEATURE_NAME_FIELD = `jexl:get(feature,'name') || get(feature,'product') || get(feature,'id')`
