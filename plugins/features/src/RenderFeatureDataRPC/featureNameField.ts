/**
 * The field a feature's name reads as a `featureField`: its name, else its ID,
 * written out so a config and its editor show what runs. A label line, a gene
 * color and its key read it.
 */
export const FEATURE_NAME_FIELD = `jexl:get(feature,'name') || get(feature,'id')`

/**
 * The field a feature's description line reads: `note`, else `description`,
 * else `function`, the only human-readable text on structural features that
 * carry no note, else `product`, from the feature or down its line of only
 * children, so a bacterial gene reads its one CDS's or RNA's product. `get()`
 * because `function` is a reserved word in the grammar.
 */
export const FEATURE_DESCRIPTION_FIELD = `jexl:get(feature,'note') || get(feature,'description') || get(feature,'function') || getUnbranched(feature,'product')`
