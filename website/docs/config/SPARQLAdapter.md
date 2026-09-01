---
id: sparqladapter
title: SPARQLAdapter
sidebar_label: Adapter -> SPARQLAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `rdf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/rdf/src/SPARQLAdapter/configSchema.ts).

## Example usage

`{refName}`, `{start}` and `{end}` are substituted per request, so the
endpoint is queried for the visible window rather than the whole genome. The
result columns become feature fields, so the query has to select at least
`?start`, `?end` and a `?uniqueID`:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'SPARQLAdapter',
    endpoint: { uri: 'https://example.com/sparql' },
    queryTemplate: `SELECT ?uniqueID ?start ?end ?strand ?name WHERE {
      ?f a :Feature ; :ref "{refName}" ; :start ?start ; :end ?end .
      FILTER(?start < {end} && ?end > {start})
    }`,
    refNamesQueryTemplate: 'SELECT DISTINCT ?refName WHERE { ?f :ref ?refName }',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

fetches features from a SPARQL endpoint, substituting the queried region into
a query template

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "SPARQLAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-endpoint">**endpoint**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: 'https://somesite.com/sparql', locationType: 'UriLocatio…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: 'https://somesite.com/sparql', locationType: 'UriLocation' }</code></pre></dialog></span> | URL of the SPARQL endpoint |
| <span id="slot-querytemplate">**queryTemplate**</span><br>[`text`](/docs/config_guides/slot_types#text) = <code>''</code> | SPARQL query where {start} {end} and {refName} will get replaced for each call |
| <span id="slot-refnamesquerytemplate">**refNamesQueryTemplate**</span><br>[`text`](/docs/config_guides/slot_types#text) = <code>''</code> | SPARQL query that returns the possible refNames in a ?refName column |
| <span id="slot-refnames">**refNames**</span><br>`stringArray` = <code>[]</code> | Possible refNames used by the SPARQL endpoint (ignored if "refNamesQueryTemplate" is provided) |
| <span id="slot-additionalqueryparams">**additionalQueryParams**</span><br>`stringArray` = <code>[]</code> | Additional parameters to add to the query, e.g. "format=JSON" |
