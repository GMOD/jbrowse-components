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

Read docs topic "live-model" before your first run_javascript call; docs topic "recipes" has a verified snippet for most asks, and "hosted-data" the config URL for any UCSC or GenArk assembly when nothing is open. Start by orienting: return jb.sessionSummary() — never assume state carried over. After changing anything, screenshot AND read the image: a wrong trackId, empty region, or dropped settings key renders as a plausible browser with something quietly missing. Verify data claims with jb.getFeatures, not from the picture.

Introspect, never guess: jb.listTracks() for trackIds; jb.describeSlots(jb.trackModel('x').activeDisplay.configuration) for a display's settings keys — an unknown settings key is dropped SILENTLY. Every result carries "logs" (what the code console.logged) and "notifications" (toasts the session raised since your previous call, with level — each reported once); settle results add "notReady" (tracks whose display is not drawing — over the fetch-size gate, or errored; these raise no toast and look fine in a screenshot) and "offscreen" (the session is taller than the window, so a viewport screenshot cuts views off — screenshot with fullPage: true, or shrink tracks): read all of them. A thrown error names the line in your code and the output printed before it.

A track too tall for the window is a height STRATEGY, not displayMode: many displays take heightMode "fit" (squash the content into the height slot) or "grow"; displayMode "compact" only shrinks each feature and will not tame a deep stack. describeSlots lists both.

Traps: mutate the MST model only via actions; write display settings with track.applyDisplaySettings(settings) (never raw assignment). view.launchTrack on an already-shown track silently applies nothing — applyDisplaySettings is the update path. Data files may spell refNames differently than the assembly ("ctgA" vs "contigA"): jb.getFeatures handles it; raw adapter code must call jb.renameRegionsIfNeeded first. A freshly created view throws "width undefined" from region getters until it mounts (await jb.mobx.when(() => view.initialized)). Aggregate large results in code; do not return thousands of raw features.`

// run_javascript's own deadline, raced inside the renderer so a runaway call
// answers with what it printed instead of a bare relay timeout. The bridge
// budgets its relay from the same number (see bridge.ts).
export const CODE_TIMEOUT_DEFAULT_MS = 120_000
export const CODE_TIMEOUT_MAX_MS = 150_000

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
    description: `Run an async JavaScript function body inside JBrowse Desktop against the LIVE session. This is the whole interface — inspecting state, building views, adding data, styling tracks, reading feature data are all code. Whatever you "return" comes back serialized (size-capped), with "logs" (everything the code console.logged) and "notifications" (toasts the session raised since the last call, with their level). A thrown error comes back with the line and column in YOUR code and the console output before it. State persists between calls on globalThis (but re-read "session" each call — it is replaced when a new config loads).

In scope: "session" (the live mobx-state-tree session model), "rootModel", "pluginManager", and the helper library "jb":
- orientation: jb.sessionSummary() (views, tracks with their trackType/display type and render phase, assemblies, visible regions); jb.session (the live session — re-read it after loadSessionSpec, which replaces the one the "session" argument names); jb.inspect(path?, maxBytes?) walks the live model by dot-path ("views.0.visibleLocStrings") and lists each node's getters and actions plus its modelType — the high-value state a snapshot filters out; docs topic "model:<modelType>" then gives every action's signature
- tracks: jb.listTracks(search?) answers { total, tracks } (the catalog, each with trackId, name, type, adapterType, assemblyNames — not a bare array); jb.trackModel(trackId) (the shown track's live model); jb.describeSlots(conf) (every settings key a display accepts — introspect, unknown keys are dropped silently); track.applyDisplaySettings(settings) — a model action targeting the track's activeDisplay — for in-place styling with legacy-key handling (e.g. { displayMode: "compact" }); it reports { applied, unapplied, failed } — "failed" is the one that means you got it wrong, "unapplied" also lists keys that are not config slots; jb.addTrack({ location, index?, assembly?, name?, show? }) (local path or URL, format inferred; a list of bigWig locations becomes one stacked MultiQuantitativeTrack)
- views: jb.loadSessionSpec(spec, settleMs?) builds views declaratively (docs topic "session-spec" is the full reference; e.g. { views: [{ type: "LinearGenomeView", assembly, loc, tracks: [...] }] }; it settles for settleMs, default 30000, and reports what is still not ready); view.navToLocString("BRCA1") navigates (gene names go through text search); await view.launchTrack(id) / view.hideTrack(id); await jb.visibleRegions(viewId?) is the visible region as numbers ({ assemblyName, refName, start, end })
- data: jb.getFeatures({ trackId, loc?, byteLimit? }) (or jb.getFeatures(trackId, loc?)) returns the track's live Feature objects (visible region by default; refNames renamed, adapter cache shared with the display; a region over the byte gate throws rather than answering short, and byteLimit raises the gate for a read you mean) — aggregate in code, return only the answer
- waiting: await jb.waitReady(ms) after mutations, before reading render state (its result carries the session's error notifications, a "notReady" list of tracks that settled without drawing, and "offscreen" when the session is taller than the window)
- lower level: jb.rootModel; jb.mst and jb.mobx (the full mobx-state-tree and mobx APIs); jb.readConfObject/jb.getConf (config slots are NOT plain properties); jb.parseLocString, await jb.getFeatureAdapterOrThrow (async), jb.renameRegionsIfNeeded, jb.getRpcSessionId, stop tokens; anything else core serves comes from jb.require(name) with the same module names plugins use (e.g. jb.require('@jbrowse/core/util'), '@jbrowse/core/configuration', '@jbrowse/core/ui') — plus the DOM and Node via window.require.

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
        timeoutMs: {
          type: 'number',
          description: `Ms the code may run before the call answers with an error and its console output so far; the code keeps running in the app (default ${CODE_TIMEOUT_DEFAULT_MS}, max ${CODE_TIMEOUT_MAX_MS}). A long job should be started, parked on globalThis and awaited from a later call instead.`,
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'docs',
    handledBy: 'stdio',
    description:
      'Read the JBrowse automation documentation, generated from the running version. Topics: "live-model" (driving the live session from run_javascript — read this before your first call), "recipes" (worked snippets for the common asks — tabulating what is on screen, a derived track, a figure per locus, adding a remote file — each verified against the app), "hosted-data" (the ready-made config URL for any UCSC or GenArk assembly, for "show me BRCA1 in human" with nothing open), "session-spec" (the session spec / URL params reference, every view type and launch key), "automating" (overview), "model:<Name>" (one model type\'s runtime API — every action with its signature, getters, properties; the type name is jb.inspect(path).modelType, e.g. model:LinearAlignmentsDisplay), "config:<Name>" (one type\'s config slots, e.g. config:BamAdapter), "types" (every documented type name by category). A long topic answers with its table of contents and section sizes; pass section (a heading, e.g. "Actions") to read one part, or "all". Works while the app is closed.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        section: {
          type: 'string',
          description:
            'A heading of the topic to read (e.g. "Linear genome view"), or "all" for the entire document',
        },
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
      'Screenshot the JBrowse Desktop window after waiting for tracks to finish loading and drawing. The text part of the result carries the session\'s notifications since your previous call, any tracks that settled without drawing, and "offscreen" when the session is taller than the window (a viewport capture cuts those views off); the image is the second part. Use it after every change worth verifying — then actually read both. fullPage: true captures the whole laid-out document instead of the viewport, which is the answer to "offscreen". To look closely at one view or track, crop: selector takes a CSS selector (a view is [data-testid="view-container-<view.id>"]; view ids come from jb.sessionSummary()), or rect takes page coordinates in CSS pixels.',
    inputSchema: {
      type: 'object',
      properties: {
        timeoutMs: {
          type: 'number',
          description:
            'Max ms to wait for rendering to settle before capturing anyway (default 30000, capped at 120000)',
        },
        fullPage: {
          type: 'boolean',
          description:
            "Capture the whole document rather than the window's viewport, so a session taller than the window comes back in one image (default false)",
        },
        selector: {
          type: 'string',
          description:
            'Crop to the first element matching this CSS selector, e.g. [data-testid="view-container-<view.id>"]',
        },
        rect: {
          type: 'object',
          description:
            'Crop to this box in CSS pixels of the page: { x, y, width, height } (as getBoundingClientRect reports)',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },
    },
  },
]
