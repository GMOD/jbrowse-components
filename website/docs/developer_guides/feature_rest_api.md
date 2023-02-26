---
id: feature_rest_api
title: JBrowse REST API and Data APIs
---

## Writing JBrowse-compatible Web Services

JBrowse ships with a REST feature adapter that can provide feature, sequence,
and quantitative data for display by any of JBrowse's track types, including
synteny tracks. To use it, a developer can implement server-side web services
that satisfy the REST API it expects.

### JBrowse REST Feature API

The JBrowse REST feature store requires the following server resources.

#### `GET (base)/reference_sequences/(assembly_name)`

Optional, but recommended. Returns a JSON array of reference sequence names in
the given assembly.

Example return JSON:

    ['ctgA','ctgB']

#### `GET (base)/has_data_for_reference/(assembly_name)/(refseq_name)`

Optional. Returns 'true' (single JSON boolean value) if the endpoint contains
feature data for the given assembly name and reference sequence name.

Example return JSON:

    true

#### `GET (base)/stats/region/(assembly_name)/(refseq_name)?start=123&end=456`

Optional, but recommended. Get statistics for a particular region. Returns the
same format as `stats/global` above, but with statistics that apply only to the
region specified.

The `refseq name` URL component, and the `start` and `end` query parameters
specify the region of interest. Statistics should be calculated for all features
that **overlap** the region in question. `start` and `end` are in interbase
coordinates.

NOTE: If this is not implemented, the statistics will be calculated as needed by
actually fetching feature data for the region in question. If your backend
\*does\* implement region stats, set `"region_stats": true` in the track or
store configuration to have JBrowse use them.

#### `GET (base)/features/(assembly_name)/(refseq_name)?start=234&end=5678`

Required. Fetch feature data (including quantitative data) for the specified
region.

The `refseq name` URL component, and the `start` and `end` query parameters
specify the region of interest. All features that **overlap** the region in
question should be returned. `start` and `end` are in interbase coordinates.
Also, track types that display features as boxes laid out on the genome (such as
HTMLFeatures, CanvasFeatures, Alignments, and Alignments2 ) require all
top-level features to have a globally-unique ID, which should be set as
`uniqueID` in the JSON emitted by the service. `uniqueID` can be any string or
number that is guaranteed to be unique among the features being emitted by this
query. It is never shown to the user.

Example return JSON:

    {
      "features": [

        /* minimal required data */
        { "start": 123, "end": 456 },

        /* typical quantitative data */
        { "start": 123, "end": 456, "score": 42 },

        /* Expected format of the single feature expected when the track is a sequence data track. */
        {"seq": "gattacagattaca", "start": 0, "end": 14},

        /* typical processed transcript with subfeatures */
        { "type": "mRNA", "start": 5975, "end": 9744, "score": 0.84, "strand": 1,
          "name": "au9.g1002.t1", "uniqueID": "globallyUniqueString3",
          "subfeatures": [
             { "type": "five_prime_UTR", "start": 5975, "end": 6109, "score": 0.98, "strand": 1 },
             { "type": "start_codon", "start": 6110, "end": 6112, "strand": 1, "phase": 0 },
             { "type": "CDS",         "start": 6110, "end": 6148, "score": 1, "strand": 1, "phase": 0 },
             { "type": "CDS",         "start": 6615, "end": 6683, "score": 1, "strand": 1, "phase": 0 },
             { "type": "CDS",         "start": 6758, "end": 7040, "score": 1, "strand": 1, "phase": 0 },
             { "type": "CDS",         "start": 7142, "end": 7319, "score": 1, "strand": 1, "phase": 2 },
             { "type": "CDS",         "start": 7411, "end": 7687, "score": 1, "strand": 1, "phase": 1 },
             { "type": "CDS",         "start": 7748, "end": 7850, "score": 1, "strand": 1, "phase": 0 },
             { "type": "CDS",         "start": 7953, "end": 8098, "score": 1, "strand": 1, "phase": 2 },
             { "type": "CDS",         "start": 8166, "end": 8320, "score": 1, "strand": 1, "phase": 0 },
             { "type": "CDS",         "start": 8419, "end": 8614, "score": 1, "strand": 1, "phase": 1 },
             { "type": "CDS",         "start": 8708, "end": 8811, "score": 1, "strand": 1, "phase": 0 },
             { "type": "CDS",         "start": 8927, "end": 9239, "score": 1, "strand": 1, "phase": 1 },
             { "type": "CDS",         "start": 9414, "end": 9494, "score": 1, "strand": 1, "phase": 0 },
             { "type": "stop_codon",  "start": 9492, "end": 9494,             "strand": 1, "phase": 0 },
             { "type": "three_prime_UTR", "start": 9495, "end": 9744, "score": 0.86, "strand": 1 }
          ]
        }
      ]
    }

### Configuring Tracks to Use a REST Feature Store

Example configuration for an HTMLFeatures track showing features from a REST
feature store with URLs based at http://my.site.com/rest/api/base, and also
adding "organism=tyrannosaurus" in the query string of all HTTP requests.

    {
        "label":      "my_rest_track",
        "key":        "REST Test Track",
        "type":       "JBrowse/View/Track/HTMLFeatures",
        "storeClass": "JBrowse/Store/SeqFeature/REST",
        "baseUrl":    "http://my.site.com/rest/api/base",
        "query": {
            "organism": "tyrannosaurus"
        }
    }

## Using JBrowse 2 with Existing Web Services

Users can extend JBrowse's functionality to with their own JavaScript code using
the JBrowse plugin system. For an overview of plugins and their structure, see
[Writing JBrowse Plugins](#writing-jbrowse-plugins 'wikilink').

To use JBrowse with an existing set of web services, users will want to
implement a JBrowse 2 plugin that contains a new Adapter that can fetch data
from them and convert it into the internal JavaScript object representations
that JBrowse expects.
