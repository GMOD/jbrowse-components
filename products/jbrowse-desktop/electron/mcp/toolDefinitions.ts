// The MCP tool surface, defined once for the stdio server (tools/list) and the
// bridge (routing). Import-free of electron and of the renderer, like
// channelTypes.ts, so all three processes can agree on it.

export interface McpToolDefinition {
  name: string
  handledBy: 'main' | 'renderer'
  description: string
  inputSchema: Record<string, unknown>
}

const TRACK_ENTRY_DOC = `A track entry is either a bare trackId string, or an object { "trackId": ... } whose other keys are display settings written inline — the same names the track menu writes, e.g. { "trackId": "hg002_ont", "type": "LinearAlignmentsDisplay", "height": 400, "colorBy": { "type": "tag", "tag": "HP" } }. Common inline keys: height, displayMode ("compact"/"collapse"), showLabels, featureHeight, minScore, maxScore, color, colorBy, defaultRendering, jexlFilters, autoscale, forceLoad.`

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'open',
    handledBy: 'main',
    description:
      'Open a JBrowse config file (config.json), a saved session (.jbrowse), or a JBrowse Web URL (a share link or a ?config=...&session=spec-... link) in JBrowse Desktop. Replaces the currently open session, flushing its autosave first. Use this to switch to a different dataset/config; use load_session_spec to build views on the already-open config.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description:
            'Absolute path to a .json config or .jbrowse session file, or an http(s) JBrowse Web URL',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'list_recent_sessions',
    handledBy: 'main',
    description:
      'List recently opened JBrowse Desktop sessions (name, file path, last-updated time). Any listed path can be reopened with the open tool.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_session',
    handledBy: 'renderer',
    description:
      'Describe the currently open session: its name, the assemblies available, and each open view (id, type, visible region, shown tracks). Call this first to see what is on screen and to get view ids for navigate/show_track.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_tracks',
    handledBy: 'renderer',
    description:
      'List the tracks available in the open session/config: trackId, name, track type, adapter type, and assembly names. Use the returned trackId values in session specs and show_track. Large configs are capped; pass search to filter by name/id substring.',
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
    name: 'show_track',
    handledBy: 'renderer',
    description: `Show a track in an open view (the given viewId or the first view that can show tracks). ${TRACK_ENTRY_DOC}`,
    inputSchema: {
      type: 'object',
      properties: {
        track: {
          description:
            'A trackId string, or a track entry object with inline display settings',
          anyOf: [{ type: 'string' }, { type: 'object' }],
        },
        viewId: { type: 'string' },
      },
      required: ['track'],
    },
  },
  {
    name: 'hide_track',
    handledBy: 'renderer',
    description: 'Hide a track currently shown in a view.',
    inputSchema: {
      type: 'object',
      properties: {
        trackId: { type: 'string' },
        viewId: { type: 'string' },
      },
      required: ['trackId'],
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
    name: 'screenshot',
    handledBy: 'main',
    description:
      'Screenshot the JBrowse Desktop window after waiting for tracks to finish loading and drawing. Use it to verify what a load_session_spec/navigate/show_track call actually produced and to inspect the data shown.',
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
