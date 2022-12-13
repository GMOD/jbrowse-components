# SPARQL Adapter

JBrowse can display genomic information stored in RDF data stores by accessing
them via a SPARQL endpoint. This is done by configuring a SPARQL adapter.

## Query template

The most basic configuration starts with a SPARQL query that returns features in
a genomic range, i.e. on a particular chromosome/contig and between a start and
end position. In such a query, replace the chromosome/contig name with
`{refName}` and the start and end with `{start}` and `{end}`. For example

```sparql
PREFIX  rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX  rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX  faldo: <http://biohackathon.org/resource/faldo#>
PREFIX  dc:   <http://purl.org/dc/elements/1.1/>

SELECT DISTINCT  ?gene (?id AS ?uniqueId) (?label AS ?name) (?desc AS ?note) ?strand ?start ?end
WHERE
  { VALUES ?location_type { faldo:ForwardStrandPosition faldo:ReverseStrandPosition faldo:BothStrandsPosition }
    ?location  faldo:begin     _:b0 .
    _:b0      rdf:type         ?location_type ;
              faldo:position   ?faldo_begin .
    ?location  faldo:end       _:b1 .
    _:b1      rdf:type         ?location_type ;
              faldo:position   ?faldo_end .
    ?location  faldo:reference  <http://rdf.ebi.ac.uk/resource/ensembl/97/homo_sapiens/GRCh38/{refName}> .
    ?gene     rdf:type         ?type ;
              rdfs:label       ?label ;
              dc:description   ?desc ;
              dc:identifier    ?id ;
              faldo:location   ?location
    BIND(if(( ?location_type = faldo:ForwardStrandPosition ), 1, if(( ?location_type = faldo:ReverseStrandPosition ), -1, 0)) AS ?strand)
    BIND(if(( ?strand = -1 ), ?faldo_end, ?faldo_begin) AS ?start)
    BIND(if(( ?strand = -1 ), ?faldo_begin, ?faldo_end) AS ?end)
    FILTER ( ( ?start >= {start} ) && ( ?end <= {end} ) )
  }
```

The SELECT in the the query must provide at least the variables `?start`,
`?end`, and `?uniqueId`. Any other variables will be added to the feature data.

## Adding a track

From a JBrowse track selector, click the "+" icon and choose "Add track". When
asked for the location of the data source, enter the SPARQL endpoint. If the
endpoint ends with `/sparql`, JBrowse will automatically choose the SPARQL
adapter. If not, choose "SPARQL adapter" in the resulting dialog. (You can use
https://www.ebi.ac.uk/rdf/services/sparql as the endpoint to demonstrate the
above example.)

You will then be able to choose a track name and type as well as the assembly to
which the track should be added. BasicTrack is suggested for most
configurations, and using other track types is covered below. Click the "Add"
button to add the track.

Next, in the track selector click the settings icon next to the track which was
just added. Paste the query template (see above) in the "queryTemplate" section.
You can also configure other aspects of the track such as a description,
category, etc.

## Advanced configuration

### Subfeatures

There are two ways to provide subfeature information. The first is to include a
`?parentUniqueId` variable with a feature. It will be created as a subfeature of
the feature with a matching `?uniqueId`.

The second way is useful if a single query response line contains information
for more than one feature, e.g. gene, transcript, and exon information on a
single line. For this type of data prefix all variables for the subfeature with
`sub_`, which will allow you to define multiple features from the same line. It
also works for deeper nested features, too, by using `sub_sub_`, etc. Parent
features that are duplicated across lines will be resolved into a single
feature. For example, take the following SPARQL query result lines:

| uniqueId   | type | start    | end      | sub_uniqueId     | sub_type   | sub_start | sub_end  | sub_sub_uniqueId | sub_sub_type | sub_sub_start | sub_sub_end |
| ---------- | ---- | -------- | -------- | ---------------- | ---------- | --------- | -------- | ---------------- | ------------ | ------------- | ----------- |
| geneId0001 | gene | 10430102 | 10452003 | transcriptId0001 | transcript | 10430518  | 10442405 | exonId0001       | exon         | 10430518      | 10430568    |
| geneId0001 | gene | 10430102 | 10452003 | transcriptId0001 | transcript | 10430518  | 10442405 | exonId0002       | exon         | 10432568      | 10433965    |

These two lines will resolve into a singe feature "geneId0001" with one child
feature "transcriptId0001", which will then itself have two child features
"exonId0001" and "exonId0002".

### Additional query parameters

JBrowse will automatically send a header stating that it expects responses to be
in the `application/json` or `application/sparql-results+json` format. Some
SPARQL endpoints, however, require additional query parameters to be passed in
order for the results be returned in JSON format, for example `format=json`.
These can be added to the "additionalQueryParams" section and will be appended
to each SPARQL request.

### Reference sequence renaming

In order for the track to take advantage of JBrowse's reference name aliasing,
it must know what reference name the SPARQL store uses. These can be entered in
one of two ways. The first is by entering a SPARQL query in the
"refNamesQueryTemplate" config section. This query should return a line for each
reference name in a `refName` column.

The second option is to enumerate the reference names explicitly in the
"refNames" config section. These will be ignored if a "refNamesQueryTemplate" is
defined.

### Other track types

BasicTracks are flexible because they don't require any additional information,
any any additional info provided in the query is just added to the feature. You
can use other tracks as well, though, as long as you make sure the SPARQL query
provides any info the track requires. For example, if you want to use a
VariantTrack, the SPARQL query must provide REF, ALT, QUAL, etc.
