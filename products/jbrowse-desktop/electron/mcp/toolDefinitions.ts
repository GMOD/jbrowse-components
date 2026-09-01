// The MCP tool surface, defined once for the stdio server (tools/list) and the
// bridge (routing). Import-free of electron and of the renderer, like
// channelTypes.ts, so all three processes can agree on it.
//
// Deliberately four tools. run_javascript is the interface; the other three
// exist only because JavaScript in the renderer cannot express them: pixels
// live in the main process (screenshot), a broken or absent session needs a
// recovery path outside itself (open), and documentation must be readable
// with the app closed (docs). Every correctness rule lives in the `jb` helper
// library instead of in tool plumbing.

// Injected into every MCP client's context via the initialize response — the
// one delivery channel that reaches all clients automatically.
export const SERVER_INSTRUCTIONS = `JBrowse Desktop (genome browser) control. One interface: run_javascript executes your code against the live session; open/screenshot/docs cover what code cannot.

Read docs topic "live-model" before your first run_javascript call. Start by orienting: return jb.sessionSummary() — never assume state carried over. After changing anything, screenshot AND read the image: a wrong trackId, empty region, or dropped settings key renders as a plausible browser with something quietly missing. Verify data claims with jb.getFeatures, not from the picture.

Introspect, never guess: jb.listTracks() for trackIds; jb.describeSlots(jb.trackModel('x').activeDisplay.configuration) for a display's settings keys — an unknown settings key is dropped SILENTLY. Settle results carry "notifications" (the session's own error toasts) AND "notReady" (tracks whose display is not drawing — over the fetch-size gate, or errored; these raise no toast and look fine in a screenshot): read both.

A track too tall for the window is a height STRATEGY, not displayMode: many displays take heightMode "fit" (squash the content into the height slot) or "grow"; displayMode "compact" only shrinks each feature and will not tame a deep stack. describeSlots lists both.

Traps: mutate the MST model only via actions; write display settings with track.applyDisplaySettings(settings) (never raw assignment). view.showTrack on an already-shown track silently applies nothing — applyDisplaySettings is the update path. Data files may spell refNames differently than the assembly ("ctgA" vs "contigA"): jb.getFeatures handles it; raw adapter code must call jb.renameRegionsIfNeeded first. A freshly created view throws "width undefined" from region getters until it mounts (await jb.mobx.when(() => view.initialized)). Aggregate large results in code; do not return thousands of raw features.`

export interface McpToolDefinition {
  name: string
  // 'stdio' is answered inside the stdio server itself, without the app
  handledBy: 'main' | 'renderer' | 'stdio'
  description: string
  inputSchema: Record<string, unknown>
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'run_javascript',
    handledBy: 'renderer',
    description: `Run an async JavaScript function body inside JBrowse Desktop against the LIVE session. This is the whole interface — inspecting state, building views, adding data, styling tracks, reading feature data are all code. Whatever you "return" comes back serialized (size-capped); state persists between calls on globalThis (but re-read "session" each call — it is replaced when a new config loads).

In scope: "session" (the live mobx-state-tree session model), "rootModel", "pluginManager", and the helper library "jb":
- orientation: jb.sessionSummary() (views, tracks with their trackType/display type and render phase, assemblies, visible regions); jb.session (the live session — re-read it after loadSessionSpec, which replaces the one the "session" argument names); jb.inspect(path?, maxBytes?) walks the live model by dot-path ("views.0.visibleLocStrings") and lists each node's getters — the high-value state a snapshot filters out
- tracks: jb.listTracks(search?) (the catalog, with trackIds); jb.trackModel(trackId) (the shown track's live model); jb.describeSlots(conf) (every settings key a display accepts — introspect, unknown keys are dropped silently); track.applyDisplaySettings(settings) — a model action targeting the track's activeDisplay — for in-place styling with legacy-key handling (e.g. { displayMode: "compact" }); it reports { applied, unapplied, failed } — "failed" is the one that means you got it wrong, "unapplied" also lists keys that are not config slots; jb.addTrack({ location, index?, assembly?, name?, show? }) (local path or URL, format inferred)
- views: jb.loadSessionSpec(spec) builds views declaratively (docs topic "session-spec" is the full reference; e.g. { views: [{ type: "LinearGenomeView", assembly, loc, tracks: [...] }] }); view.navToLocString("BRCA1") navigates (gene names go through text search); view.showTrack(id) / view.hideTrack(id)
- data: jb.getFeatures({ trackId, loc? }) returns the track's live Feature objects (visible region by default; refNames renamed, adapter cache shared with the display) — aggregate in code, return only the answer
- waiting: await jb.waitReady(ms) after mutations, before reading render state (its result carries the session's error notifications and a "notReady" list of tracks that settled without drawing)
- lower level: jb.mst and jb.mobx (the full mobx-state-tree and mobx APIs), jb.readConfObject/jb.getConf (config slots are NOT plain properties), jb.parseLocString, jb.getFeatureAdapterOrThrow, jb.renameRegionsIfNeeded, jb.getRpcSessionId, stop tokens; anything else core serves comes from jb.require(name) with the same module names plugins use (e.g. jb.require('@jbrowse/core/util'), '@jbrowse/core/configuration', '@jbrowse/core/ui') — plus the DOM and Node via window.require.

READ docs topic "live-model" FIRST: a short orientation with working examples. Mutate the model only through actions.`,
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
      'Read the raw JBrowse automation documentation. Topics: "live-model" (driving the live session from run_javascript — read this before your first call), "session-spec" (the full session spec / URL params reference, every view type and launch key), "automating" (overview). Call with no topic to list them. Works even while the app is closed.',
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
      'Open a JBrowse config in JBrowse Desktop, replacing the open session; returns once the new session is up (or says so if it is still loading). Takes a local config.json or .jbrowse session file, the URL of a hosted config.json (jbrowse.org/ucsc/<db>/config.json and the rest of genomes.jbrowse.org), or a JBrowse Web URL carrying a session spec or an &assembly=/&loc= shorthand. The recovery path when no session is open or the current one is broken — it works where run_javascript cannot. With NO target, lists the recently opened sessions instead; any listed path can then be opened.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description:
            'Absolute path to a .json config or .jbrowse session file, the http(s) URL of a hosted config.json, or a JBrowse Web URL. Omit to list recent sessions.',
        },
      },
    },
  },
  {
    name: 'screenshot',
    handledBy: 'main',
    description:
      "Screenshot the JBrowse Desktop window after waiting for tracks to finish loading and drawing. The text part of the result carries the session's error notifications and any tracks that settled without drawing; the image is the second part. Use it after every change worth verifying — then actually read both.",
    inputSchema: {
      type: 'object',
      properties: {
        timeoutMs: {
          type: 'number',
          description:
            'Max ms to wait for rendering to settle before capturing anyway (default 30000, capped at 120000)',
        },
      },
    },
  },
]
