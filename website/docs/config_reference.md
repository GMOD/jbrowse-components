---
id: config_reference
title: Config reference
toplevel: true
---

## BaseRpcDriver

#### slot: workerCount

```js

    /**
     * !slot
     */
    workerCount: {
      type: 'number',
      description:
        'The number of workers to use. If 0 (the default) JBrowse will decide how many workers to use.',
      defaultValue: 0,
    }
```

## MainThreadRpcDriver

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: BaseRpcDriverConfigSchema
```

## WebWorkerRpcDriver

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: BaseRpcDriverConfigSchema
```

#### slot: defaultDriver

```js

    /**
     * !slot
     */
    defaultDriver: {
      type: 'string',
      description:
        'the RPC driver to use for tracks and tasks that are not configured to use a specific RPC backend',
      defaultValue: 'MainThreadRpcDriver',
    }
```

#### slot: drivers

```js
/**
 * !slot
 */
drivers: types.optional(
  types.map(
    types.union(
      MainThreadRpcDriverConfigSchema,
      WebWorkerRpcDriverConfigSchema,
    ),
  ),
  { MainThreadRpcDriver: { type: 'MainThreadRpcDriver' } },
)
```

#### slot: name

```js

    /**
     * !slot
     */
    name: {
      type: 'string',
      defaultValue: 'nameOfConnection',
      description: 'a unique name for this connection',
    }
```

#### slot: assemblyNames

```js

    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'optional list of names of assemblies in this connection',
    }
```

## InternetAccount

the "base" internet account type

#### slot: name

```js

    /**
     * !slot
     */
    name: {
      description: 'descriptive name of the internet account',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: description

```js

    /**
     * !slot
     */
    description: {
      description: 'a description of the internet account',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: authHeader

```js

    /**
     * !slot
     */
    authHeader: {
      description: 'request header for credentials',
      type: 'string',
      defaultValue: 'Authorization',
    }
```

#### slot: tokenType

```js

    /**
     * !slot
     */
    tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: domains

```js

    /**
     * !slot
     */
    domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: [],
    }
```

## InternetAccount

the "base" internet account type

## CytobandAdapter

#### slot: cytobandLocation

```js

    /**
     * !slot
     */
    cytobandLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/cytoband.txt.gz' },
    }
```

## BaseTrack

#### slot: name

```js

      /**
       * !slot
       */
      name: {
        description: 'descriptive name of the track',
        type: 'string',
        defaultValue: 'Track',
      }
```

#### slot: assemblyNames

```js

      /**
       * !slot
       */
      assemblyNames: {
        description: 'name of the assembly (or assemblies) track belongs to',
        type: 'stringArray',
        defaultValue: ['assemblyName'],
      }
```

#### slot: description

```js

      /**
       * !slot
       */
      description: {
        description: 'a description of the track',
        type: 'string',
        defaultValue: '',
      }
```

#### slot: category

```js

      /**
       * !slot
       */
      category: {
        description: 'the category and sub-categories of a track',
        type: 'stringArray',
        defaultValue: [],
      }
```

#### slot: metadata

```js

      /**
       * !slot
       */
      metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      }
```

#### slot: adapter

```js
/**
 * !slot
 */
adapter: pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: textSearching.indexedAttributes

```js

        /**
         * !slot textSearching.indexedAttributes
         */
        indexingAttributes: {
          type: 'stringArray',
          description:
            'list of which feature attributes to index for text searching',
          defaultValue: ['Name', 'ID'],
        }
```

#### slot: textSearching.indexingFeatureTypesToExclude

```js

        /**
         * !slot textSearching.indexingFeatureTypesToExclude
         */
        indexingFeatureTypesToExclude: {
          type: 'stringArray',
          description: 'list of feature types to exclude in text search index',
          defaultValue: ['CDS', 'exon'],
        }
```

#### slot: textSearching.textSearchAdapter

```js
/**
 * !slot textSearching.textSearchAdapter
 */
textSearchAdapter: pluginManager.pluggableConfigSchemaType(
  'text search adapter',
)
```

#### slot: displays

```js
/**
 * !slot
 */
displays: types.array(pluginManager.pluggableConfigSchemaType('display'))
```

#### slot: formatDetails.feature

```js

        /**
         * !slot formatDetails.feature
         */
        feature: {
          type: 'frozen',
          description: 'adds extra fields to the feature details',
          defaultValue: {},
          contextVariable: ['feature'],
        }
```

#### slot: formatDetails.subfeatures

```js


        /**
         * !slot formatDetails.subfeatures
         */
        subfeatures: {
          type: 'frozen',
          description: 'adds extra fields to the subfeatures of a feature',
          defaultValue: {},
          contextVariable: ['feature'],
        }
```

#### slot: formatDetails.depth

```js


        /**
         * !slot formatDetails.depth
         */
        depth: {
          type: 'number',
          defaultValue: 2,
          description:
            'depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g. you may not want to format the exon/cds subfeatures, so limited to 2',
        }
```

## BamAdapter

used to configure BAM adapter

#### slot: bamLocation

```js

      /**
       * !slot
       */
      bamLocation: {
        type: 'fileLocation',
        defaultValue: { uri: '/path/to/my.bam', locationType: 'UriLocation' },
      }
```

#### slot: index.indexType

```js

        /**
         * !slot index.indexType
         */
        indexType: {
          model: types.enumeration('IndexType', ['BAI', 'CSI']),
          type: 'stringEnum',
          defaultValue: 'BAI',
        }
```

#### slot: index.location

```js

        /**
         * !slot index.location
         */
        location: {
          type: 'fileLocation',
          defaultValue: {
            uri: '/path/to/my.bam.bai',
            locationType: 'UriLocation',
          },
        }
```

#### slot: fetchSizeLimit

```js

      /**
       * !slot
       */
      fetchSizeLimit: {
        type: 'number',
        description:
          'used to determine when to display a warning to the user that too much data will be fetched',
        defaultValue: 5_000_000,
      }
```

#### slot: sequenceAdapter

```js

      /**
       * !slot
       * generally refers to the reference genome assembly's sequence adapter
       * currently needs to be manually added
       */
      sequenceAdapter: {
        type: 'frozen',
        description:
          'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
        defaultValue: null,
      }
```

## CramAdapter

used to configure CRAM adapter

#### slot: fetchSizeLimit

```js

      /**
       * !slot fetchSizeLimit
       */
      fetchSizeLimit: {
        type: 'number',
        description:
          'used to determine when to display a warning to the user that too much data will be fetched',
        defaultValue: 3_000_000,
      }
```

#### slot: cramLocation

```js


      /**
       * !slot cramLocation
       */
      cramLocation: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.cram',
          locationType: 'UriLocation',
        },
      }
```

#### slot: craiLocation

```js


      /**
       * !slot craiLocation
       */
      craiLocation: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.cram.crai',
          locationType: 'UriLocation',
        },
      }
```

#### slot: sequenceAdapter

```js
/**
 * !slot sequenceAdapter
 * generally refers to the reference genome assembly's sequence adapter
 * currently needs to be manually added
 */
sequenceAdapter: pluginManager.pluggableConfigSchemaType('adapter')
```

## HtsgetBamAdapter

Used to fetch data from Htsget endpoints in BAM format
Uses @gmod/bam

#### slot: htsgetBase

```js

      /**
       * !slot
       */
      htsgetBase: {
        type: 'string',
        description: 'the base URL to fetch from',
        defaultValue: '',
      }
```

#### slot: htsgetTrackId

```js

      /**
       * !slot
       */
      htsgetTrackId: {
        type: 'string',
        description: 'the trackId, which is appended to the base URL',
        defaultValue: '',
      }
```

#### slot: sequenceAdapter

```js

      /**
       * !slot
       */
      sequenceAdapter: {
        type: 'frozen',
        description:
          'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
        defaultValue: null,
      }
```

## BaseLinearDisplay

BaseLinearDisplay is a "base" config that is extended by classes like
"LinearBasicDisplay" (used for feature tracks, etc) and "LinearBareDisplay"
(more stripped down than even the basic display, not commonly used)

#### slot: maxFeatureScreenDensity

```js

    /**
     * !slot
     */
    maxFeatureScreenDensity: {
      type: 'number',
      description:
        'maximum features per pixel that is displayed in the view, used if byte size estimates not available',
      defaultValue: 0.3,
    }
```

#### slot: fetchSizeLimit

```js

    /**
     * !slot
     */
    fetchSizeLimit: {
      type: 'number',
      defaultValue: 1_000_000,
      description:
        "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
    }
```

## LinearBareDisplay

#### slot: renderer

```js
/**
 * !slot
 */
renderer: pluginManager.pluggableConfigSchemaType('renderer')
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseLinearDisplayConfigSchema
```

## LinearBasicDisplay

#### slot: mouseover

```js

      /**
       * !slot
       */
      mouseover: {
        type: 'string',
        description: 'what to display in a given mouseover',
        defaultValue: `jexl:get(feature,'name')`,

        contextVariable: ['feature'],
      }
```

#### slot: renderer

```js
/**
 * !slot
 */
renderer: pluginManager.pluggableConfigSchemaType('renderer')
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseLinearDisplayConfigSchema
```

## LinearAlignmentsDisplay

has a "pileup" sub-display, where you can see individual reads and a
quantitative "snpcoverage" sub-display track showing SNP frequencies

#### slot: pileupDisplay

```js
/**
 * !slot
 */
pileupDisplay: pluginManager.getDisplayType('LinearPileupDisplay').configSchema
```

#### slot: snpCoverageDisplay

```js
/**
 * !slot
 */
snpCoverageDisplay: pluginManager.getDisplayType('LinearSNPCoverageDisplay')
  .configSchema
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseLinearDisplayConfigSchema
```

## LinearPileupDisplay

#### slot: defaultRendering

```js

      /**
       * !slot
       */
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['pileup']),
        defaultValue: 'pileup',
      }
```

#### slot: renderers

```js
/**
 * !slot
 */
renderers: ConfigurationSchema('RenderersConfiguration', {
  PileupRenderer: pluginManager.getRendererType('PileupRenderer').configSchema,
})
```

#### slot: maxFeatureScreenDensity

```js

      /**
       * !slot
       */
      maxFeatureScreenDensity: {
        type: 'number',
        description: 'maximum features per pixel that is displayed in the view',
        defaultValue: 5,
      }
```

#### slot: colorScheme

```js


      /**
       * !slot
       */
      colorScheme: {
        type: 'stringEnum',
        model: types.enumeration('colorScheme', [
          'strand',
          'normal',
          'insertSize',
          'insertSizeAndOrientation',
          'mappingQuality',
          'tag',
        ]),
        description: 'color scheme to use',
        defaultValue: 'normal',
      }
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager)
```

## LinearSNPCoverageDisplay

#### slot: autoscale

```js

      /**
       * !slot
       */
      autoscale: {
        type: 'stringEnum',
        defaultValue: 'local',
        model: types.enumeration('Autoscale type', ['local']),
        description:
          'performs local autoscaling (no other options for SNP Coverage available)',
      }
```

#### slot: minScore

```js

      /**
       * !slot
       */
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
      }
```

#### slot: maxScore

```js

      /**
       * !slot
       */
      maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Number.MAX_VALUE,
      }
```

#### slot: scaleType

```js

      /**
       * !slot
       */
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']), // todo zscale
        description: 'The type of scale to use',
        defaultValue: 'linear',
      }
```

#### slot: inverted

```js

      /**
       * !slot
       */ inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      }
```

#### slot: multiTicks

```js

      /**
       * !slot
       */
      multiTicks: {
        type: 'boolean',
        description: 'Display multiple values for the ticks',
        defaultValue: false,
      }
```

#### slot: renderers

```js
/**
 * !slot
 */
renderers: ConfigurationSchema('RenderersConfiguration', {
  SNPCoverageRenderer: pluginManager.getRendererType('SNPCoverageRenderer')
    .configSchema,
})
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseLinearDisplayConfigSchema
```

## PileupRenderer

#### slot: color

```js

    /**
     * !slot
     * default magenta here is used to detect the user has not customized this
     */
    color: {
      type: 'color',
      description: 'the color of each feature in a pileup alignment',
      defaultValue: '#f0f',
      contextVariable: ['feature'],
    }
```

#### slot: orientationType

```js


    /**
     * !slot
     */
    orientationType: {
      type: 'stringEnum',
      model: types.enumeration('orientationType', ['fr', 'rf', 'ff']),
      defaultValue: 'fr',
      description:
        'read sequencer orienation. fr is normal "reads pointing at each other ---> <--- while some other sequencers can use other options',
    }
```

#### slot: displayMode

```js

    /**
     * !slot
     */
    displayMode: {
      type: 'stringEnum',
      model: types.enumeration('displayMode', [
        'normal',
        'compact',
        'collapse',
      ]),
      description: 'Alternative display modes',
      defaultValue: 'normal',
    }
```

#### slot: minSubfeatureWidth

```js

    /**
     * !slot
     */
    minSubfeatureWidth: {
      type: 'number',
      description:
        'the minimum width in px for a pileup mismatch feature. use for increasing/decreasing mismatch marker widths when zoomed out, e.g. 0 or 1',
      defaultValue: 0.7,
    }
```

#### slot: maxHeight

```js

    /**
     * !slot
     */
    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a pileup rendering',
      defaultValue: 1200,
    }
```

#### slot: maxClippingSize

```js

    /**
     * !slot
     */
    maxClippingSize: {
      type: 'integer',
      description: 'the max clip size to be used in a pileup rendering',
      defaultValue: 10000,
    }
```

#### slot: height

```js

    /**
     * !slot
     */
    height: {
      type: 'number',
      description: 'the height of each feature in a pileup alignment',
      defaultValue: 7,
      contextVariable: ['feature'],
    }
```

#### slot: noSpacing

```js

    /**
     * !slot
     */
    noSpacing: {
      type: 'boolean',
      description: 'remove spacing between features',
      defaultValue: false,
    }
```

#### slot: largeInsertionIndicatorScale

```js

    /**
     * !slot
     */
    largeInsertionIndicatorScale: {
      type: 'number',
      description:
        'scale at which to draw the large insertion indicators (bp/pixel)',
      defaultValue: 10,
    }
```

#### slot: mismatchAlpha

```js

    /**
     * !slot
     */
    mismatchAlpha: {
      type: 'boolean',
      defaultValue: false,
      description: 'Fade low quality mismatches',
    }
```

## SNPCoverageAdapter

#### slot: subadapter

```js
/**
 * !slot
 * normally refers to a BAM or CRAM adapter
 */
subadapter: pluginManager.pluggableConfigSchemaType('adapter')
```

## SNPCoverageRenderer

#### slot: clipColor

```js

    /**
     * !slot
     */
    clipColor: {
      type: 'color',
      description: 'the color of the clipping marker',
      defaultValue: 'red',
    }
```

#### slot: indicatorThreshold

```js

    /**
     * !slot
     */
    indicatorThreshold: {
      type: 'number',
      description:
        'the proportion of reads containing a insertion/clip indicator',
      defaultValue: 0.4,
    }
```

#### slot: drawArcs

```js

    /**
     * !slot
     */
    drawArcs: {
      type: 'boolean',
      description: 'Draw sashimi-style arcs for intron features',
      defaultValue: true,
    }
```

#### slot: drawInterbaseCounts

```js

    /**
     * !slot
     */
    drawInterbaseCounts: {
      type: 'boolean',
      description:
        'draw count "upsidedown histogram" of the interbase events that don\'t contribute to the coverage count so are not drawn in the normal histogram',
      defaultValue: true,
    }
```

#### slot: drawIndicators

```js

    /**
     * !slot
     */
    drawIndicators: {
      type: 'boolean',
      description:
        'draw a triangular indicator where an event has been detected',
      defaultValue: true,
    }
```

## ArcRenderer

#### slot: color

```js

    /**
     * !slot
     */
    color: {
      type: 'color',
      description: 'the color of the arcs',
      defaultValue: 'darkblue',
      contextVariable: ['feature'],
    }
```

#### slot: thickness

```js

    /**
     * !slot
     */
    thickness: {
      type: 'number',
      description: 'the thickness of the arcs',
      defaultValue: `jexl:logThickness(feature,'score')`,
      contextVariable: ['feature'],
    }
```

#### slot: label

```js

    /**
     * !slot
     */
    label: {
      type: 'string',
      description: 'the label to appear at the apex of the arcs',
      defaultValue: `jexl:get(feature,'score')`,
      contextVariable: ['feature'],
    }
```

#### slot: height

```js

    /**
     * !slot
     */
    height: {
      type: 'number',
      description: 'the height of the arcs',
      defaultValue: `jexl:log10(get(feature,'end')-get(feature,'start'))*50`,
      contextVariable: ['feature'],
    }
```

#### slot: caption

```js

    /**
     * !slot
     */
    caption: {
      type: 'string',
      description:
        'the caption to appear when hovering over any point on the arcs',
      defaultValue: `jexl:get(feature,'name')`,
      contextVariable: ['feature'],
    }
```

## LinearArcDisplay

#### slot: renderer

```js
/**
 * !slot
 */
renderer: types.optional(pluginManager.pluggableConfigSchemaType('renderer'), {
  type: 'ArcRenderer',
})
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseLinearDisplayConfigSchema
```

## OAuthConfigSchema

#### slot: tokenType

```js

    /**
     * !slot
     */
    tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: 'Bearer',
    }
```

#### slot: authEndpoint

```js

    /**
     * !slot
     */
    authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: tokenEndpoint

```js

    /**
     * !slot
     */
    tokenEndpoint: {
      description: 'the token endpoint of the internet account',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: needsPKCE

```js

    /**
     * !slot
     */
    needsPKCE: {
      description: 'boolean to indicate if the endpoint needs a PKCE code',
      type: 'boolean',
      defaultValue: false,
    }
```

#### slot: clientId

```js

    /**
     * !slot
     */
    clientId: {
      description: 'id for the OAuth application',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: scopes

```js

    /**
     * !slot
     */
    scopes: {
      description: 'optional scopes for the authorization call',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: responseType

```js

    /**
     * !slot
     */
    responseType: {
      description: 'the type of response from the authorization endpoint',
      type: 'string',
      defaultValue: 'code',
    }
```

#### slot: hasRefreshToken

```js

    /**
     * !slot
     */
    hasRefreshToken: {
      description: 'true if the endpoint can supply a refresh token',
      type: 'boolean',
      defaultValue: false,
    }
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: BaseInternetAccountConfig
```

## DropboxOAuthConfigSchema

#### slot: authEndpoint

```js

    /**
     * !slot
     */
    authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: 'https://www.dropbox.com/oauth2/authorize',
    }
```

#### slot: tokenEndpoint

```js

    /**
     * !slot
     */
    tokenEndpoint: {
      description: 'the token endpoint of the internet account',
      type: 'string',
      defaultValue: 'https://api.dropbox.com/oauth2/token',
    }
```

#### slot: needsPKCE

```js

    /**
     * !slot
     */
    needsPKCE: {
      description: 'boolean to indicate if the endpoint needs a PKCE code',
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: domains

```js

    /**
     * !slot
     */
    domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: [
        'addtodropbox.com',
        'db.tt',
        'dropbox.com',
        'dropboxapi.com',
        'dropboxbusiness.com',
        'dropbox.tech',
        'getdropbox.com',
      ],
    }
```

#### slot: hasRefreshToken

```js

    /**
     * !slot
     */
    hasRefreshToken: {
      description: 'true if the endpoint can supply a refresh token',
      type: 'boolean',
      defaultValue: true,
    }
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: OAuthConfigSchema
```

## ExternalTokenConfigSchema

#### slot: validateWithHEAD

```js

    /**
     * !slot
     */
    validateWithHEAD: {
      description: 'validate the token with a HEAD request before using it',
      type: 'boolean',
      defaultValue: true,
    }
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: BaseInternetAccountConfig
```

## GoogleDriveOAuthConfigSchema

#### slot: authEndpoint

```js

    /**
     * !slot
     */
    authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: 'https://accounts.google.com/o/oauth2/v2/auth',
    }
```

#### slot: scopes

```js

    /**
     * !slot
     */
    scopes: {
      description: 'optional scopes for the authorization call',
      type: 'string',
      defaultValue: 'https://www.googleapis.com/auth/drive.readonly',
    }
```

#### slot: domains

```js

    /**
     * !slot
     */
    domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: ['drive.google.com"'],
    }
```

#### slot: responseType

```js

    /**
     * !slot
     */
    responseType: {
      description: 'the type of response from the authorization endpoint',
      type: 'string',
      defaultValue: 'token',
    }
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: OAuthConfigSchema
```

## HTTPBasicConfigSchema

#### slot: tokenType

```js

    /**
     * !slot
     */
    tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: 'Basic',
    }
```

#### slot: validateWithHEAD

```js

    /**
     * !slot
     */
    validateWithHEAD: {
      description: 'validate the token with a HEAD request before using it',
      type: 'boolean',
      defaultValue: true,
    }
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: BaseInternetAccountConfig
```

## BedAdapter

#### slot: bedLocation

```js

    /**
     * !slot
     */
    bedLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bed.gz', locationType: 'UriLocation' },
    }
```

#### slot: columnNames

```js

    /**
     * !slot
     */
    columnNames: {
      type: 'stringArray',
      description: 'List of column names',
      defaultValue: [],
    }
```

#### slot: scoreColumn

```js

    /**
     * !slot
     */
    scoreColumn: {
      type: 'string',
      description: 'The column to use as a "score" attribute',
      defaultValue: '',
    }
```

#### slot: autoSql

```js

    /**
     * !slot
     */
    autoSql: {
      type: 'string',
      description: 'The autoSql definition for the data fields in the file',
      defaultValue: '',
    }
```

#### slot: colRef

```js

    /**
     * !slot
     */
    colRef: {
      type: 'number',
      description: 'The column to use as a "refName" attribute',
      defaultValue: 0,
    }
```

#### slot: colStart

```js

    /**
     * !slot
     */
    colStart: {
      type: 'number',
      description: 'The column to use as a "start" attribute',
      defaultValue: 1,
    }
```

#### slot: colEnd

```js

    /**
     * !slot
     */
    colEnd: {
      type: 'number',
      description: 'The column to use as a "end" attribute',
      defaultValue: 2,
    }
```

## BedTabixAdapter

#### slot: bedGzLocation

```js

    /**
     * !slot
     */
    bedGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bed.gz', locationType: 'UriLocation' },
    }
```

#### slot: index.indexType

```js

      /**
       * !slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      }
```

#### slot: index.location

```js

      /**
       * !slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bed.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```

#### slot: columnNames

```js


    /**
     * !slot
     */
    columnNames: {
      type: 'stringArray',
      description: 'List of column names',
      defaultValue: [],
    }
```

#### slot: scoreColumn

```js


    /**
     * !slot
     */
    scoreColumn: {
      type: 'string',
      description: 'The column to use as a "score" attribute',
      defaultValue: '',
    }
```

#### slot: autoSql

```js


    /**
     * !slot
     */
    autoSql: {
      type: 'string',
      description: 'The autoSql definition for the data fields in the file',
      defaultValue: '',
    }
```

## BigBedAdapter

#### slot: bigBedLocation

```js

    /**
     * !slot
     */
    bigBedLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bb', locationType: 'UriLocation' },
    }
```

## ChainAdapter

#### slot: assemblyNames

```js

    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Target is the first value in the array, query is the second',
    }
```

#### slot: targetAssembly

```js

    /**
     * !slot
     * can be specified as alternative to assemblyNames
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
    }
```

#### slot: queryAssembly

```js

    /**
     * !slot
     * can be specified as alternative to assemblyNames
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
    }
```

#### slot: chainLocation

```js

    /**
     * !slot
     */
    chainLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/file.chain', locationType: 'UriLocation' },
    }
```

## DeltaAdapter

#### slot: assemblyNames

```js

    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The target assembly name is the first value in the array, query assembly name is the second',
    }
```

#### slot: targetAssembly

```js

    /**
     * !slot
     * alternative to assembly names
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
    }
```

#### slot: queryAssembly

```js

    /**
     * !slot
     * alternative to assembly names
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
    }
```

#### slot: deltaLocation

```js

    /**
     * !slot
     */
    deltaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/file.delta', locationType: 'UriLocation' },
    }
```

## MCScanAnchorsAdapter

#### slot: mcscanAnchorsLocation

```js

    /**
     * !slot
     */
    mcscanAnchorsLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mcscan.anchors',
        locationType: 'UriLocation',
      },
    }
```

#### slot: bed1Location

```js

    /**
     * !slot
     */
    bed1Location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.bed',
        locationType: 'UriLocation',
      },
    }
```

#### slot: bed2Location

```js

    /**
     * !slot
     */
    bed2Location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.bed',
        locationType: 'UriLocation',
      },
    }
```

#### slot: assemblyNames

```js

    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    }
```

## MCScanSimpleAnchorsAdapter

#### slot: mcscanSimpleAnchorsLocation

```js

    /**
     * !slot
     */
    mcscanSimpleAnchorsLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mcscan.anchors.simple',
        locationType: 'UriLocation',
      },
    }
```

#### slot: bed1Location

```js

    /**
     * !slot
     */
    bed1Location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.bed',
        locationType: 'UriLocation',
      },
    }
```

#### slot: bed2Location

```js

    /**
     * !slot
     */
    bed2Location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.bed',
        locationType: 'UriLocation',
      },
    }
```

#### slot: assemblyNames

```js


    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    }
```

## MashMapAdapter

#### slot: assemblyNames

```js

    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Target is the first value in the array, query is the second',
    }
```

#### slot: targetAssembly

```js


    /**
     * !slot
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
    }
```

#### slot: queryAssembly

```js

    /**
     * !slot
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
    }
```

#### slot: outLocation

```js

    /**
     * !slot
     */
    outLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mashmap.out',
        locationType: 'UriLocation',
      },
    }
```

## PAFAdapter

#### slot: assemblyNames

```js

    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The target assembly name is the first value in the array, query assembly name is the second',
    }
```

#### slot: targetAssembly

```js

    /**
     * !slot
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
    }
```

#### slot: queryAssembly

```js

    /**
     * !slot
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
    }
```

#### slot: pafLocation

```js

    /**
     * !slot
     */
    pafLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.paf',
        locationType: 'UriLocation',
      },
    }
```

## FromConfigAdapter

#### slot: features

```js

    /**
     * !slot
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    }
```

#### slot: featureClass

```js

    /**
     * !slot
     */
    featureClass: {
      type: 'string',
      defaultValue: 'SimpleFeature',
    }
```

## FromConfigRegionsAdapter

used for specifying refNames+sizes of an assembly

#### slot: features

```js

    /**
     * !slot
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    }
```

#### slot: featureClass

```js

    /**
     * !slot
     */
    featureClass: {
      type: 'string',
      defaultValue: 'SimpleFeature',
    }
```

## FromConfigSequenceAdapter

#### slot: features

```js

    /**
     * !slot
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    }
```

#### slot: featureClass

```js

    /**
     * !slot
     */
    featureClass: {
      type: 'string',
      defaultValue: 'SimpleFeature',
    }
```

## RefNameAliasAdapter

#### slot: location

```js

    /**
     * !slot
     */
    location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/aliases.txt',
        locationType: 'UriLocation',
      },
    }
```

#### slot: refNameColumn

```js

    /**
     * !slot
     */
    refNameColumn: {
      type: 'number',
      defaultValue: 0,
    }
```

#### slot: color

```js

    /**
     * !slot
     */
    color: {
      type: 'color',
      description:
        'the color of each feature in a synteny, used with colorBy:default',
      defaultValue: 'black',
      contextVariable: ['feature'],
    }
```

#### slot: posColor

```js


    /**
     * !slot
     */
    posColor: {
      type: 'color',
      description: 'the color for forward alignments, used with colorBy:strand',
      defaultValue: 'blue',
    }
```

#### slot: negColor

```js

    /**
     * !slot
     */
    negColor: {
      type: 'color',
      description: 'the color for reverse alignments, used with colorBy:strand',
      defaultValue: 'red',
    }
```

#### slot: lineWidth

```js


    /**
     * !slot
     */
    lineWidth: {
      type: 'number',
      description: 'width of the lines to be drawn',
      defaultValue: 2.5, // 2.5 is similar to D-GENIES
    }
```

#### slot: colorBy

```js


    /**
     * !slot
     */
    colorBy: {
      type: 'stringEnum',
      model: types.enumeration('colorBy', [
        'identity',
        'meanQueryIdentity',
        'mappingQuality',
        'strand',
        'default',
      ]),
      description: `Color by options:<br/>
<ul>
  <li>"identity" - the identity of the particular hit, similar to D-GENIES, use the other config slots 'thresholds' and 'thresholdsPalette' to define colors for this setting</li>
  <li>"meanQueryIdentity" - calculates the weighted mean identity (weighted by alignment length) of all the hits that the query maps to (e.g. if the query is split aligned to many target, uses their weighted mean. can help show patterns of more related and distant synteny after WGD)</li>
  <li>"mappingQuality" - uses mapping quality from PAF, some adapters don't have this setting</li>
  <li>"strand" - colors negative alignments with negColor and positive alignments with posColor</li>
  <li>"default" - uses the 'color' config slot</li>
</ul>`,
      defaultValue: 'default',
    }
```

#### slot: thresholdsPalette

```js


    /**
     * !slot
     */
    thresholdsPalette: {
      type: 'stringArray',
      defaultValue: ['#094b09', '#2ebd40', '#d5670b', '#ffd84b'],
      description: 'threshold colors, used with colorBy:identity',
    }
```

#### slot: thresholds

```js


    /**
     * !slot
     */
    thresholds: {
      type: 'stringArray',
      defaultValue: ['0.75', '0.5', '0.25', '0'],
      description: 'threshold breakpoints, used with colorBy:identity',
    }
```

## Gff3Adapter

#### slot: gffLocation

```js

    /**
     * !slot
     */
    gffLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gff', locationType: 'UriLocation' },
    }
```

## Gff3TabixAdapter

#### slot: gffGzLocation

```js

    /**
     * !slot
     */
    gffGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gff.gz', locationType: 'UriLocation' },
    }
```

#### slot: index.indexType

```js

      /**
       * !slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      }
```

#### slot: index.indexType

```js

      /**
       * !slot index.indexType
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.gff.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```

#### slot: dontRedispatch

```js

    /**
     * !slot
     * the Gff3TabixAdapter has to "redispatch" if it fetches a region and
     * features it finds inside that region extend outside the region we requested.
     * you can disable this for certain feature types to avoid fetching e.g. the
     * entire chromosome
     */
    dontRedispatch: {
      type: 'stringArray',
      defaultValue: ['chromosome', 'region'],
    }
```

## GtfAdapter

#### slot: gtfLocation

```js

    /**
     * !slot
     */
    gtfLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gtf', locationType: 'UriLocation' },
    }
```

## HicAdapter

#### slot: hicLocation

```js

    /**
     * !slot
     */
    hicLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.hic',
        locationType: 'UriLocation',
      },
    }
```

## HicRenderer

#### slot: baseColor

```js

    /**
     * !slot
     */
    baseColor: {
      type: 'color',
      description: 'base color to be used in the hic alignment',
      defaultValue: '#f00',
    }
```

#### slot: color

```js

    /**
     * !slot
     */
    color: {
      type: 'color',
      description: 'the color of each feature in a hic alignment',
      defaultValue: `jexl:colorString(hsl(alpha(baseColor,min(1,count/(maxScore/20)))))`,
      contextVariable: ['count', 'maxScore', 'baseColor'],
    }
```

#### slot: maxHeight

```js


    /**
     * !slot
     */
    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a hic rendering',
      defaultValue: 600,
    }
```

## LinearHicDisplay

#### slot: renderer

```js
/**
 * !slot
 */
renderer: pluginManager.getRendererType('HicRenderer').configSchema
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseLinearDisplayConfigSchema
```

## JBrowse1Connection

#### slot: dataDirLocation

```js

    /**
     * !slot
     */
    dataDirLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'http://mysite.com/jbrowse/data/',
        locationType: 'UriLocation',
      },
      description:
        'the location of the JBrowse 1 data directory, often something like http://mysite.com/jbrowse/data/',
    }
```

#### slot: assemblyNames

```js

    /**
     * !slot
     */
    assemblyNames: {
      description:
        'name of the assembly the connection belongs to, should be a single entry',
      type: 'stringArray',
      defaultValue: [],
    }
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseConnectionConfig
```

## NCListAdapter

#### slot: rootUrlTemplate

```js

    /**
     * !slot
     */
    rootUrlTemplate: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/{refseq}/trackData.json',
        locationType: 'UriLocation',
      },
    }
```

#### slot: refNames

```js

    /**
     * !slot
     */
    refNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of refNames used by the NCList used for aliasing',
    }
```

## LinearSyntenyRenderer

#### slot: color

```js

    /**
     * !slot
     */
    color: {
      type: 'color',
      description: 'the color of each feature in a synteny',
      defaultValue: 'rgb(255,100,100,0.3)',
    }
```

## SyntenyTrack

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: createBaseTrackConfig(pluginManager)
```

## BgzipFastaAdapter

#### slot: fastaLocation

```js

    /**
     * !slot
     */
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.gz', locationType: 'UriLocation' },
    }
```

#### slot: faiLocation

```js

    /**
     * !slot
     */
    faiLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa.gz.fai',
        locationType: 'UriLocation',
      },
    }
```

#### slot: metadataLocation

```js

    /**
     * !slot
     */
    metadataLocation: {
      description: 'Optional metadata file',
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/fa.metadata.yaml',
        locationType: 'UriLocation',
      },
    }
```

#### slot: gziLocation

```js

    /**
     * !slot
     */
    gziLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa.gz.gzi',
        locationType: 'UriLocation',
      },
    }
```

## ChromSizesAdapter

#### slot: chromSizesLocation

```js

    /**
     * !slot
     */
    chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/species.chrom.sizes',
        locationType: 'UriLocation',
      },
    }
```

## DivSequenceRenderer

#### slot: height

```js

    /**
     * !slot
     */
    height: {
      type: 'number',
      description: 'height in pixels of each line of sequence',
      defaultValue: 16,
    }
```

## GCContentAdapter

#### slot: sequenceAdapter

```js
/**
 * !slot
 */
sequenceAdapter: pluginManager.pluggableConfigSchemaType('adapter')
```

## IndexedFastaAdapter

#### slot: fastaLocation

```js

    /**
     * !slot
     */
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa', locationType: 'UriLocation' },
    }
```

#### slot: faiLocation

```js

    /**
     * !slot
     */
    faiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.fai', locationType: 'UriLocation' },
    }
```

#### slot: metadataLocation

```js

    /**
     * !slot
     */
    metadataLocation: {
      description: 'Optional metadata file',
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/fa.metadata.yaml',
        locationType: 'UriLocation',
      },
    }
```

## LinearReferenceSequenceDisplay

#### slot: renderer

```js
/**
 * !slot
 */
renderer: divSequenceRendererConfigSchema
```

## ReferenceSequenceTrack

used to display base level DNA sequence tracks

#### slot: adapter

```js
/**
 * !slot adapter
 * !type AdapterType
 * configuration for track adapter
 */
adapter: pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: displays

```js
/**
 * !slot displays
 * !type DisplayType[]
 * configuration for the displays e.g. LinearReferenceSequenceDisplay
 */
displays: types.array(pluginManager.pluggableConfigSchemaType('display'))
```

#### slot: name

```js


      /**
       * !slot name
       */
      name: {
        type: 'string',
        description:
          'optional track name, otherwise uses the "Reference sequence (assemblyName)"',
        defaultValue: '',
      }
```

#### slot: metadata

```js


      /**
       * !slot metadata
       */
      metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      }
```

## TwoBitAdapter

#### slot: twoBitLocation

```js

    /**
     * !slot
     */
    twoBitLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.2bit', locationType: 'UriLocation' },
    }
```

#### slot: chromSizesLocation

```js

    /**
     * !slot
     */
    chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/default.chrom.sizes',
        locationType: 'UriLocation',
      },
      description:
        'An optional chrom.sizes file can be supplied to speed up loading since parsing the twobit file can take time',
    }
```

## SvgFeatureRenderer

#### slot: color1

```js

    /**
     * !slot
     */
    color1: {
      type: 'color',
      description: 'the main color of each feature',
      defaultValue: 'goldenrod',
      contextVariable: ['feature'],
    }
```

#### slot: color2

```js

    /**
     * !slot
     */
    color2: {
      type: 'color',
      description:
        'the secondary color of each feature, used for connecting lines, etc',
      defaultValue: 'black',
      contextVariable: ['feature'],
    }
```

#### slot: color3

```js

    /**
     * !slot
     */
    color3: {
      type: 'color',
      description:
        'the tertiary color of each feature, often used for contrasting fills, like on UTRs',
      defaultValue: '#357089',
      contextVariable: ['feature'],
    }
```

#### slot: outline

```js


    /**
     * !slot
     */
    outline: {
      type: 'color',
      description: 'the outline for features',
      defaultValue: '',
      contextVariable: ['feature'],
    }
```

#### slot: height

```js

    /**
     * !slot
     */
    height: {
      type: 'number',
      description: 'height in pixels of the main body of each feature',
      defaultValue: 10,
      contextVariable: ['feature'],
    }
```

#### slot: showLabels

```js

    /**
     * !slot
     */
    showLabels: {
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: showDescriptions

```js


    /**
     * !slot
     */
    showDescriptions: {
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: labels.name

```js

      /**
       * !slot labels.name
       */
      name: {
        type: 'string',
        description:
          'the primary name of the feature to show, if space is available',
        defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
        contextVariable: ['feature'],
      }
```

#### slot: labels.nameColor

```js

      /**
       * !slot labels.nameColor
       */
      nameColor: {
        type: 'color',
        description: 'the color of the name label, if shown',
        defaultValue: 'black',
        contextVariable: ['feature'],
      }
```

#### slot: labels.description

```js

      /**
       * !slot labels.description
       */
      description: {
        type: 'string',
        description: 'the text description to show, if space is available',
        defaultValue: `jexl:get(feature,'note') || get(feature,'description')`,
        contextVariable: ['feature'],
      }
```

#### slot: labels.descriptionColor

```js

      /**
       * !slot labels.descriptionColor
       */
      descriptionColor: {
        type: 'color',
        description: 'the color of the description, if shown',
        defaultValue: 'blue',
        contextVariable: ['feature'],
      }
```

#### slot: labels.fontSize

```js


      /**
       * !slot labels.fontSize
       */
      fontSize: {
        type: 'number',
        description:
          'height in pixels of the text to use for names and descriptions',
        defaultValue: 13,
        contextVariable: ['feature'],
      }
```

#### slot: displayMode

```js


    /**
     * !slot
     */
    displayMode: {
      type: 'stringEnum',
      model: types.enumeration('displayMode', [
        'normal',
        'compact',
        'reducedRepresentation',
        'collapse',
      ]),
      description: 'Alternative display modes',
      defaultValue: 'normal',
    }
```

#### slot: maxFeatureGlyphExpansion

```js


    /**
     * !slot
     */
    maxFeatureGlyphExpansion: {
      type: 'number',
      description:
        "maximum number of pixels on each side of a feature's bounding coordinates that a glyph is allowed to use",
      defaultValue: 500,
    }
```

#### slot: maxHeight

```js


    /**
     * !slot
     */
    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a svg rendering',
      defaultValue: 600,
    }
```

#### slot: subParts

```js


    /**
     * !slot
     */
    subParts: {
      type: 'string',
      description: 'subparts for a glyph',
      defaultValue: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
    }
```

#### slot: impliedUTRs

```js


    /**
     * !slot
     */
    impliedUTRs: {
      type: 'boolean',
      description: 'imply UTR from the exon and CDS differences',
      defaultValue: false,
    }
```

## TrixTextSearchAdapter

#### slot: ixFilePath

```js

    /**
     * !slot
     */
    ixFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'out.ix', locationType: 'UriLocation' },
      description: 'the location of the trix ix file',
    }
```

#### slot: ixxFilePath

```js

    /**
     * !slot
     */
    ixxFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'out.ixx', locationType: 'UriLocation' },
      description: 'the location of the trix ixx file',
    }
```

#### slot: metaFilePath

```js

    /**
     * !slot
     */
    metaFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'meta.json', locationType: 'UriLocation' },
      description: 'the location of the metadata json file for the trix index',
    }
```

#### slot: tracks

```js

    /**
     * !slot
     */
    tracks: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
    }
```

#### slot: assemblyNames

```js

    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    }
```

## LinearVariantDisplay

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager)
```

## VcfAdapter

#### slot: vcfLocation

```js

    /**
     * !slot
     */
    vcfLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.vcf', locationType: 'UriLocation' },
    }
```

## VcfTabixAdapter

#### slot: vcfGzLocation

```js

    /**
     * !slot
     */
    vcfGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.vcf.gz', locationType: 'UriLocation' },
    }
```

#### slot: index.indexType

```js

      /**
       * !slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      }
```

#### slot: index.location

```js

      /**
       * !slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.vcf.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```

## StructuralVariantChordRenderer

#### slot: strokeColor

```js

    /**
     * !slot
     */
    strokeColor: {
      type: 'color',
      description: 'the line color of each arc',
      defaultValue: 'rgba(255,133,0,0.32)',
      contextVariable: ['feature'],
    }
```

#### slot: strokeColorSelected

```js

    /**
     * !slot
     */
    strokeColorSelected: {
      type: 'color',
      description: 'the line color of an arc that has been selected',
      defaultValue: 'black',
      contextVariable: ['feature'],
    }
```

#### slot: strokeColorHover

```js

    /**
     * !slot
     */
    strokeColorHover: {
      type: 'color',
      description:
        'the line color of an arc that is being hovered over with the mouse',
      defaultValue: '#555',
      contextVariable: ['feature'],
    }
```

## ChordVariantDisplay

#### slot: renderer

```js
/**
 * !slot
 */
renderer: types.optional(pluginManager.pluggableConfigSchemaType('renderer'), {
  type: 'StructuralVariantChordRenderer',
})
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseChordDisplayConfig
```

## BigWigAdapter

#### slot: bigWigLocation

```js

    /**
     * !slot
     */
    bigWigLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bw',
        locationType: 'UriLocation',
      },
    }
```

#### slot: source

```js


    /**
     * !slot
     */
    source: {
      type: 'string',
      defaultValue: '',
      description: 'Used for multiwiggle',
    }
```

## WiggleRenderer

this is the "base wiggle renderer config schema"

#### slot: color

```js

    /**
     * !slot
     */
    color: {
      type: 'color',
      description: 'the color of track, overrides posColor and negColor',
      defaultValue: '#f0f',
    }
```

#### slot: posColor

```js

    /**
     * !slot
     */
    posColor: {
      type: 'color',
      description: 'the color to use when the score is positive',
      defaultValue: 'blue',
    }
```

#### slot: negColor

```js

    /**
     * !slot
     */
    negColor: {
      type: 'color',
      description: 'the color to use when the score is negative',
      defaultValue: 'red',
    }
```

#### slot: clipColor

```js

    /**
     * !slot
     */
    clipColor: {
      type: 'color',
      description: 'the color of the clipping marker',
      defaultValue: 'red',
    }
```

#### slot: bicolorPivot

```js

    /**
     * !slot
     */
    bicolorPivot: {
      type: 'stringEnum',
      model: types.enumeration('Scale type', [
        'numeric',
        'mean',
        'z_score',
        'none',
      ]),
      description: 'type of bicolor pivot',
      defaultValue: 'numeric',
    }
```

#### slot: bicolorPivotValue

```js

    /**
     * !slot
     */
    bicolorPivotValue: {
      type: 'number',
      defaultValue: 0,
      description: 'value to use for bicolor pivot',
    }
```

## DensityRenderer

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseWiggleRendererConfigSchema
```

#### slot: configSchema

```js
configSchema = ConfigurationSchema(
  'LinePlotRenderer',
  {
    /**
     * !slot
     */
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    },
  },
  {
    /**
     * !baseConfiguration
     */
    baseConfiguration: baseWiggleRendererConfigSchema,
    explicitlyTyped: true,
  },
)
```

#### slot: displayCrossHatches

```js

    /**
     * !slot
     */
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    }
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseWiggleRendererConfigSchema
```

## LinearWiggleDisplay

#### slot: autoscale

```js

      /**
       * !slot
       */
      autoscale: {
        type: 'stringEnum',
        defaultValue: 'local',
        model: types.enumeration('Autoscale type', [
          'global',
          'local',
          'globalsd',
          'localsd',
          'zscore',
        ]),
        description:
          'global/local using their min/max values or w/ standard deviations (globalsd/localsd)',
      }
```

#### slot: minimalTicks

```js


      /**
       * !slot
       */
      minimalTicks: {
        type: 'boolean',
        defaultValue: false,
        description: 'use the minimal amount of ticks',
      }
```

#### slot: minScore

```js


      /**
       * !slot
       */
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
      }
```

#### slot: maxScore

```js

      /**
       * !slot
       */
      maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Number.MAX_VALUE,
      }
```

#### slot: numStdDev

```js

      /**
       * !slot
       */
      numStdDev: {
        type: 'number',
        description:
          'number of standard deviations to use for autoscale types globalsd or localsd',
        defaultValue: 3,
      }
```

#### slot: scaleType

```js

      /**
       * !slot
       */
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']), // todo zscale
        description: 'The type of scale to use',
        defaultValue: 'linear',
      }
```

#### slot: inverted

```js

      /**
       * !slot
       */
      inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      }
```

#### slot: defaultRendering

```js


      /**
       * !slot
       */
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['density', 'xyplot', 'line']),
        defaultValue: 'xyplot',
      }
```

#### slot: renderers

```js
/**
 * !slot
 */
renderers: ConfigurationSchema('RenderersConfiguration', {
  DensityRenderer: DensityRendererConfigSchema,
  XYPlotRenderer: XYPlotRendererConfigSchema,
  LinePlotRenderer: LinePlotRendererConfigSchema,
})
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseLinearDisplayConfigSchema
```

## MultiDensityRenderer

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseWiggleRendererConfigSchema
```

## MultiQuantitativeTrack

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: createBaseTrackConfig(pluginManager)
```

## QuantitativeTrack

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: createBaseTrackConfig(pluginManager)
```

## MultiLinearWiggleDisplay

#### slot: autoscale

```js

      /**
       * !slot
       */
      autoscale: {
        type: 'stringEnum',
        defaultValue: 'local',
        model: types.enumeration('Autoscale type', [
          'global',
          'local',
          'globalsd',
          'localsd',
          'zscore',
        ]),
        description:
          'global/local using their min/max values or w/ standard deviations (globalsd/localsd)',
      }
```

#### slot: minimalTicks

```js


      /**
       * !slot
       */
      minimalTicks: {
        type: 'boolean',
        defaultValue: false,
        description: 'use the minimal amount of ticks',
      }
```

#### slot: minScore

```js


      /**
       * !slot
       */
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
      }
```

#### slot: maxScore

```js

      /**
       * !slot
       */
      maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Number.MAX_VALUE,
      }
```

#### slot: numStdDev

```js

      /**
       * !slot
       */
      numStdDev: {
        type: 'number',
        description:
          'number of standard deviations to use for autoscale types globalsd or localsd',
        defaultValue: 3,
      }
```

#### slot: scaleType

```js

      /**
       * !slot
       */
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']), // todo zscale
        description: 'The type of scale to use',
        defaultValue: 'linear',
      }
```

#### slot: inverted

```js


      /**
       * !slot
       */
      inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      }
```

#### slot: defaultRendering

```js


      /**
       * !slot
       */
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', [
          'multirowxy',
          'xyplot',
          'multirowdensity',
          'multiline',
          'multirowline',
        ]),
        defaultValue: 'multirowxy',
      }
```

#### slot: renderers

```js
/**
 * !slot
 */
renderers: ConfigurationSchema('RenderersConfiguration', {
  MultiXYPlotRenderer: MultiXYPlotRendererConfigSchema,
  MultiDensityRenderer: MultiDensityRendererConfigSchema,
  MultiRowXYPlotRenderer: MultiRowXYPlotRendererConfigSchema,
  MultiLineRenderer: MultiLineRendererConfigSchema,
  MultiRowLineRenderer: MultiRowLineRendererConfigSchema,
})
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseLinearDisplayConfigSchema
```

## MultiRowLineRenderer

#### slot: displayCrossHatches

```js

    /**
     * !slot
     */
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    }
```

#### slot: summaryScoreMode

```js

    /**
     * !slot
     */
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'avg',
    }
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseWiggleRendererConfigSchema
```

## MultiRowXYPlotRenderer

#### slot: filled

```js

    /**
     * !slot
     */
    filled: {
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: displayCrossHatches

```js

    /**
     * !slot
     */
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    }
```

#### slot: summaryScoreMode

```js

    /**
     * !slot
     */
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'whiskers',
    }
```

#### slot: minSize

```js

    /**
     * !slot
     */
    minSize: {
      type: 'number',
      defaultValue: 0,
    }
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseWiggleRendererConfigSchema
```

## MultiWiggleAdapter

#### slot: subadapters

```js

    /**
     * !slot
     */
    subadapters: {
      type: 'frozen',
      defaultValue: [],
      description: 'array of subadapter JSON objects',
    }
```

#### slot: bigWigs

```js

    /**
     * !slot
     */
    bigWigs: {
      type: 'frozen',
      description:
        'array of bigwig filenames, alternative to the subadapters slot',
      defaultValue: [],
    }
```

## MultiXYPlotRenderer

#### slot: filled

```js

    /**
     * !slot
     */
    filled: {
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: displayCrossHatches

```js

    /**
     * !slot
     */
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    }
```

#### slot: summaryScoreMode

```js

    /**
     * !slot
     */
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'avg',
    }
```

#### slot: minSize

```js

    /**
     * !slot
     */
    minSize: {
      type: 'number',
      defaultValue: 0,
    }
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseWiggleRendererConfigSchema
```

## XYPlotRenderer

#### slot: filled

```js

    /**
     * !slot
     */
    filled: {
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: displayCrossHatches

```js

    /**
     * !slot
     */
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    }
```

#### slot: summaryScoreMode

```js

    /**
     * !slot
     */
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'whiskers',
    }
```

#### slot: minSize

```js

    /**
     * !slot
     */
    minSize: {
      type: 'number',
      defaultValue: 0,
    }
```

#### derives from:

```js
/**
 * !baseConfiguration
 */
baseConfiguration: baseWiggleRendererConfigSchema
```
