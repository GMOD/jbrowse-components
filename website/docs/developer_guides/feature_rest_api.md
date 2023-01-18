---
id: feature_rest_api
title: JBrowse REST API and Data APIs
---

## Writing JBrowse-compatible Web Services

Beginning in version 1.9.0, JBrowse ships with a REST data store adapter
(JBrowse/Store/SeqFeature/REST) that can provide feature, sequence, and
quantitative data for display by any of JBrowse's track types. To use it, a
developer can implement server-side web services that satisfy the REST API it
expects.

JBrowse version 1.11.0 added a REST adaptor that can look up names and name
prefixes (for type-ahead completion) from REST endpoints as well (see JBrowse
REST Names API below).

### JBrowse REST Feature Store API

The JBrowse REST feature store requires the following server resources.

#### `GET (base)/stats/global`

Required. Returns a JSON object containing global statistics about the features
served by this store.

Example:

       {

          "featureDensity": 0.02,

          "featureCount": 234235,

          "scoreMin": 87,
          "scoreMax": 87,
          "scoreMean": 42,
          "scoreStdDev": 2.1
       }

None of the attributes in the example above are required to be present. However,
if the store is primarily providing positional data (such as genes), it is
recommended to provide at least `featureDensity` (average number of features per
basepair), since JBrowse uses this metric to make many decisions about how to
display features. For stores that primarily provide quantitative data, it is
recommended to also provide score statistics.

#### `GET (base)/stats/region/(refseq_name)?start=123&end=456`

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

#### `GET (base)/stats/regionFeatureDensities/(refseq_name)?start=123&end=456&basesPerBin=20000`

Optional, added in JBrowse 1.10.7. Get binned feature counts for a certain
region, which are used only by HTMLFeatures tracks to draw density histograms at
certain zoom levels. If your backend implements this endpoint, set
`"region_feature_densities": true` in the track or store configuration to have
JBrowse use it.

The `refseq name` URL component, and the `start` and `end` query parameters
specify the region of interest. `start` and `end` are in interbase coordinates.

The `basesPerBin` is an integer which must be used to determine the number of
bins - the endpoint may not choose its own bin size. `max` should be the maximum
value for the density, the global maximum for the entire track.

Example returned JSON:

    {
      "bins":  [ 51, 50, 58, 63, 57, 57, 65, 66, 63, 61,
                 56, 49, 50, 47, 39, 38, 54, 41, 50, 71,
                 61, 44, 64, 60, 42
               ],
      "stats": {
        "basesPerBin": 200,
        "max": 88
      }
    }

Note that the `stats.max` attribute sets that Y-axis scale for the entire track,
so should probably be set according to the global (or nearly global) max count
for bins of that size.

#### `GET (base)/features/(refseq_name)?start=234&end=5678`

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
implement a JBrowse Store module in JavaScript that can fetch data from them and
convert it into the internal JavaScript object representations that JBrowse
expects. In general terms, the steps to follow to do this would be:

1.  Create a new plugin using `bin/new-plugin.pl` or manually.
2.  Enable the plugin by adding its name to `plugins` in the JBrowse
    configuration (in jbrowse_conf.json, trackList.json, in the constructor
    arguments in index.html, or elsewhere).
3.  Create a new data store class in the plugin's JS directory that inherits
    from JBrowse/Store/SeqFeature and overrides its methods.

### Example custom JBrowse store class

In `plugins/MyPlugin/js/Store/SeqFeature/FooBaseWebServices.js`, usable in store
or track configurations as `MyPlugin/Store/SeqFeature/FooBaseWebServices`.

Note that the most basic class could simply have a "getFeatures" function that
grabs the feature data.

```
    /**
     * Example store class that uses Dojo's XHR libraries to fetch data
     * from backend web services.  In the case of feature data, converts
     * the data into JBrowse SimpleFeature objects (see
     * JBrowse/Model/SimpleFeature.js) but any objects that support the
     * same methods as SimpleFeature are fine.
     */

    define([
               'dojo/_base/declare',
               'dojo/_base/array',
               'dojo/request/xhr',
               'JBrowse/Store/SeqFeature',
               'JBrowse/Model/SimpleFeature'
           ],
           function( declare, array, xhr, SeqFeatureStore, SimpleFeature ) {

    return declare( SeqFeatureStore, {

        constructor: function( args ) {
            // perform any steps to initialize your new store.  
        },

        getFeatures: function( query, featureCallback, finishCallback, errorCallback ) {
            var thisB = this;
            xhr.get( this.config.baseUrl+'my/features/webservice/url',
                     { handleAs: 'json', query: query }
                   ).then(

                       function( featuredata ) {

                           // transform the feature data into feature
                           // objects and call featureCallback for each
                           // one. for example, the default REST
                           // store does something like:
                           array.forEach( featuredata || [],
                               function( featureKeyValue ) {
                                   var feature = new SimpleFeature({
                                           data: featureKeyValue
                                       });
                                   featureCallback( feature );
                               });

                           // call the endCallback when all the features
                           // have been processed
                           finishCallback();
                       },

                       errorCallback
                   );

        }
    });
    });
```

Note: other feature stores can be "derived from" or extended in different ways.
The FeatureCoverage store class is a good example of a store class that uses the
BAM store, but instead overrides the functionality to calculate coverage.
