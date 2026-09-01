// The MCP tool surface, defined once for the stdio server (tools/list) and the
// bridge (routing). Import-free of electron and of the renderer, like
// channelTypes.ts, so all three processes can agree on it.

export interface McpToolDefinition {
  name: string
  // 'stdio' is answered inside the stdio server itself, without the app
  handledBy: 'main' | 'renderer' | 'stdio'
  description: string
  inputSchema: Record<string, unknown>
}

const TRACK_ENTRY_DOC = `A track entry is either a bare trackId string, or an object { "trackId": ... } whose other keys are display settings written inline — the same names the track menu writes, e.g. { "trackId": "hg002_ont", "type": "LinearAlignmentsDisplay", "height": 400, "colorBy": { "type": "tag", "tag": "HP" } }. Common inline keys: height, displayMode ("compact"/"collapse"), showLabels, featureHeight, minScore, maxScore, color, colorBy, defaultRendering, jexlFilters, autoscale, forceLoad.`

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'evaluate',
    handledBy: 'renderer',
    description: `The raw primitive: run an async JavaScript function body inside the app against the LIVE session — everything the other tools do is expressible here, and anything they don't cover is too. In scope: "session" (the mobx-state-tree session model), "rootModel", "pluginManager", and "jb" ({ mst: full mobx-state-tree API, mobx: { autorun, when, runInAction, observable }, readConfObject, getConf, describeSlots, parseLocString, getFeatureAdapterOrThrow, getRpcSessionId, renameRegionsIfNeeded, createStopToken, stopStopToken, waitReady }), plus the DOM and Node via window.require. Whatever you "return" comes back serialized (size-capped). Invent your own utilities: state persists between calls on globalThis (but re-read "session" each call — it is replaced when a new config loads). MST rules: read via properties and getters (snapshots omit getters), mutate ONLY via actions, read config slots with jb.readConfObject, never guess settings keys — jb.describeSlots(display.configuration) lists them. READ docs topic "live-model" FIRST — it is a short orientation with working examples (model layout, direct adapter data access, refName renaming, waiting on renders).`,
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description:
            'Async function body. Use "return" for the value you want back; "await" is available.',
        },
        maxBytes: {
          type: 'number',
          description:
            'Largest serialized result to return whole before truncating to a preview (default 50000)',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'docs',
    handledBy: 'stdio',
    description:
      'Read the raw JBrowse automation documentation. Topics: "live-model" (driving the live session from evaluate — read this before your first evaluate), "session-spec" (the full session spec / URL params reference, every view type and launch key), "automating" (overview). No topic lists them. Works even while the app is closed.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
      },
    },
  },
  {
    name: 'open',
    handledBy: 'main',
    description:
      'Open a JBrowse config file (config.json), a saved session (.jbrowse), or a JBrowse Web URL (a share link or a ?config=...&session=spec-... link) in JBrowse Desktop. Replaces the currently open session, flushing its autosave first. Use this to switch to a different dataset/config; use load_session_spec to build views on the already-open config. With NO target, lists the recently opened sessions instead (name, file path, last-updated) — any listed path can then be opened.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description:
            'Absolute path to a .json config or .jbrowse session file, or an http(s) JBrowse Web URL. Omit to list recent sessions.',
        },
      },
    },
  },
  {
    name: 'inspect_session',
    handledBy: 'renderer',
    description: `Inspect the open session. With NO path: a compact overview — session name, assemblies, each open view with its visible region and shown tracks (call this first). With a path: walk the LIVE session model — both raw state and the computed getters a snapshot filters out. Examples: "views.0" (one view: its state plus a "getters" list naming what else it can answer), "views.0.visibleLocStrings" (what region is on screen), "views.0.tracks.0.displays.0" (a live display's state), "views.0.totalBp". Large values come back as a keys/summary listing to drill into; property reads only, nothing is mutated.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Dot-path from the session root, numeric segments index arrays (e.g. "views.0.visibleLocStrings"). Omit for the root.',
        },
        maxBytes: {
          type: 'number',
          description:
            'Largest value to return whole before summarizing (default 20000)',
        },
      },
    },
  },
  {
    name: 'list_tracks',
    handledBy: 'renderer',
    description:
      'List the tracks available in the open session/config: trackId, name, track type, adapter type, and assembly names. Use the returned trackId values in session specs and the track tool. Large configs are capped; pass search to filter by name/id substring.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Case-insensitive substring filter on name and trackId',
        },
        assembly: {
          type: 'string',
          description: 'Only tracks whose assemblyNames include this assembly',
        },
        limit: { type: 'number', description: 'Max entries (default 100)' },
      },
    },
  },
  {
    name: 'load_session_spec',
    handledBy: 'renderer',
    description: `Build a fresh set of views from a declarative "session spec", against the tracks and assemblies of the currently open config. This is the main visualization-construction tool; it replaces the open views (same config/plugins) and returns the resulting session summary once rendering settles.

The spec: { "views": [...], "sessionTracks": [...], "sessionAssemblies": [...], "layout": ..., "sessionName": ... } — all but "views" optional.

Each view has a "type" plus that type's launch keys:
- LinearGenomeView: { "type": "LinearGenomeView", "assembly": "hg38", "loc": "chr1:100,000-200,000", "tracks": [...] }. "loc" also accepts a gene name or other searchable identifier, and "highlight" accepts locstrings to mark.
- LinearSyntenyView: { "type": "LinearSyntenyView", "views": [{ "loc", "assembly", "tracks" }, ...], "tracks": [synteny track ids] }
- DotplotView: { "type": "DotplotView", "views": [{ "assembly", "loc"? } x2], "tracks": [...] }
- CircularView: { "type": "CircularView", "assembly", "tracks" }
- BreakpointSplitView: { "type": "BreakpointSplitView", "views": [two LGV specs] }
- SpreadsheetView / SvInspectorView: { "type", "assembly", "uri" }

${TRACK_ENTRY_DOC}

"sessionTracks" holds full track configs not in the open config (e.g. from a URL: { "trackId": "my_bw", "name": ..., "assemblyNames": ["hg38"], "type": "QuantitativeTrack", "adapter": { "type": "BigWigAdapter", "bigWigLocation": { "uri": "https://..." } } }); views can then reference them by trackId. "layout": { "direction": "horizontal"|"vertical"|"tabs", "children": [...] } or { "views": [indices] } arranges multiple views.`,
    inputSchema: {
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          description: 'The session spec (see tool description)',
          properties: {
            views: { type: 'array' },
            sessionTracks: { type: 'array' },
            sessionAssemblies: { type: 'array' },
            sessionConnections: { type: 'array' },
            layout: { type: 'object' },
            sessionName: { type: 'string' },
          },
          required: ['views'],
        },
      },
      required: ['spec'],
    },
  },
  {
    name: 'navigate',
    handledBy: 'renderer',
    description:
      'Navigate a linear genome view to a location. Accepts a locstring ("chr1:1,000,000-1,100,000", "chr1:1000000..1100000", a whole refName like "chr1"), a gene name or other searchable identifier ("BRCA1"), or space-separated locstrings for a split view. Targets the given viewId or the first linear view.',
    inputSchema: {
      type: 'object',
      properties: {
        loc: { type: 'string' },
        viewId: { type: 'string' },
      },
      required: ['loc'],
    },
  },
  {
    name: 'track',
    handledBy: 'renderer',
    description: `Show, update, or hide tracks in an open view.

action "show": open a track — "track" is a trackId string or an entry object with inline display settings. On a track ALREADY shown this is a no-op (settings are not re-applied; use "update").
action "update": change display settings of shown tracks IN PLACE — no reload, the display re-renders reactively. "settings" is required; select ONE track with "track" (exact trackId), a GROUP with "match" (case-insensitive substring of trackId or name), or EVERY shown track by passing neither — e.g. action "update", settings {"displayMode": "compact"} with no selector makes all tracks compact. The response reports per track which keys applied and which could not (changing the display "type" itself needs hide then show).
action "hide": remove a shown track — "track" is its trackId.

${TRACK_ENTRY_DOC} "settings" speaks that same vocabulary — any config slot of the track's display works; when unsure which keys a display takes, introspect it (docs topic "live-model" shows jb.describeSlots).`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['show', 'update', 'hide'] },
        track: {
          description:
            'trackId string (show/update/hide), or for show an entry object with inline display settings',
          anyOf: [{ type: 'string' }, { type: 'object' }],
        },
        match: {
          type: 'string',
          description:
            'update only: select all shown tracks whose trackId or name contains this (case-insensitive)',
        },
        settings: {
          type: 'object',
          description: 'update only: display settings to apply',
        },
        viewId: { type: 'string' },
      },
      required: ['action'],
    },
  },
  {
    name: 'add_track',
    handledBy: 'renderer',
    description:
      'Add a data file as a new track in the open session, inferring the adapter and track type from the file extension (BAM/CRAM, VCF, BED, GFF3, bigWig, bigBed, Hi-C, PAF, ...). Takes a local absolute path or an http(s) URL; index files (.bai, .tbi, ...) are found by convention or given explicitly. The track is added to the session (not the config file on disk) and shown in a view unless show is false.',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description:
            'Absolute local file path or http(s) URL of the data file',
        },
        index: {
          type: 'string',
          description:
            'Path/URL of the index file, when not at the default name',
        },
        assembly: {
          type: 'string',
          description:
            'Assembly the data belongs to; defaults to the only/first assembly',
        },
        name: { type: 'string', description: 'Display name for the track' },
        show: {
          type: 'boolean',
          description: 'Show in the first compatible view (default true)',
        },
        viewId: { type: 'string' },
      },
      required: ['location'],
    },
  },
  {
    name: 'get_features',
    handledBy: 'renderer',
    description:
      'Fetch the actual feature data of a track — the same records the display draws — as JSON: genes with subfeatures, variants with genotype/INFO, alignments with flags and CIGAR, quantitative values, etc. Runs the track adapter on the main thread (no worker serialization). Defaults to the region currently visible on screen (so navigate first, then inspect what is shown); pass loc for an arbitrary region without moving the view. Long strings and arrays are truncated; raise limit for more features. For aggregation, filtering, or anything beyond a bounded peek, use evaluate with jb.getFeatureAdapterOrThrow instead and return only the reduced answer.',
    inputSchema: {
      type: 'object',
      properties: {
        trackId: { type: 'string' },
        loc: {
          type: 'string',
          description:
            'Optional locstring ("ctgA:1,000-2,000" or a whole refName); default is the visible region of the (first navigable or viewId) view',
        },
        assembly: {
          type: 'string',
          description: "With loc: assembly name; defaults to the track's first",
        },
        limit: {
          type: 'number',
          description: 'Max features to return (default 30, max 500)',
        },
        viewId: { type: 'string' },
      },
      required: ['trackId'],
    },
  },
  {
    name: 'screenshot',
    handledBy: 'main',
    description:
      'Screenshot the JBrowse Desktop window after waiting for tracks to finish loading and drawing. Use it to verify what a load_session_spec/navigate/track call actually produced and to inspect the data shown.',
    inputSchema: {
      type: 'object',
      properties: {
        timeoutMs: {
          type: 'number',
          description:
            'Max ms to wait for rendering to settle before capturing anyway (default 30000)',
        },
      },
    },
  },
]
