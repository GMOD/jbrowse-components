---
id: sessionloader
title: SessionLoader
sidebar_label: General -> SessionLoader
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/SessionLoader.ts).

## Overview

Bootstraps a jbrowse-web session from URL params: resolves the config plus the
shared/local session sources, builds the plugin manager, and exposes the
loading/error state the app shell renders around.

## Members

| Member                                                     | Kind       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [configPath](#property-configpath)                         | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sessionQuery](#property-sessionquery)                     | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [password](#property-password)                             | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [adminKey](#property-adminkey)                             | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [loc](#property-loc)                                       | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sessionTracks](#property-sessiontracks)                   | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [assembly](#property-assembly)                             | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [tracks](#property-tracks)                                 | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [tracklist](#property-tracklist)                           | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [highlight](#property-highlight)                           | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [nav](#property-nav)                                       | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [extendSession](#property-extendsession)                   | Properties | when true, jb1-style URL params (loc/tracks/highlight/...) navigate within the configured defaultSession instead of replacing it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [sessionName](#property-sessionname)                       | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [initialTimestamp](#property-initialtimestamp)             | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [hubURL](#property-huburl)                                 | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [configSnapshot](#property-configsnapshot)                 | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sessionSource](#property-sessionsource)                   | Properties | the single resolved session, also the HMR/reload restore vehicle (preset to a `snapshot` variant when rebuilding from a live session)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [sessionTriaged](#volatile-sessiontriaged)                 | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [runtimePlugins](#volatile-runtimeplugins)                 | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sessionPlugins](#volatile-sessionplugins)                 | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [configError](#volatile-configerror)                       | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [pluginManager](#volatile-pluginmanager)                   | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [pluginManagerError](#volatile-pluginmanagererror)         | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [buildAutorunDisposer](#volatile-buildautorundisposer)     | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [initializeStarted](#volatile-initializestarted)           | Volatiles  | guards initialize() to run exactly once per loader, even across the activate/deactivate/activate cycle StrictMode drives on mount. Not reset by deactivate (unlike buildAutorunDisposer) so a remount never refetches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [sessionQueryType](#getter-sessionquerytype)               | Getters    | the `session=` URL param's type prefix (`share`/`spec`/`encoded`/`json`/ `local`), or undefined when there's no recognized prefix. Mirrors the prefixes stripped by stripPrefix()                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [isHubSession](#getter-ishubsession)                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [isJb1StyleSession](#getter-isjb1stylesession)             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [extendDefaultSession](#getter-extenddefaultsession)       | Getters    | reads the opt-in `&extendSession=true` URL param that makes jb1-style params layer onto the configured defaultSession instead of replacing it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [pluginsLoaded](#getter-pluginsloaded)                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [isSessionLoaded](#getter-issessionloaded)                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sessionTracksParsed](#getter-sessiontracksparsed)         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [resolvedConfigPath](#getter-resolvedconfigpath)           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [ready](#getter-ready)                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [defaultSessionViewInit](#getter-defaultsessionviewinit)   | Getters    | URL-derived init (loc/tracks/highlight/...) applied onto the defaultSession's first view when `extendDefaultSession` is enabled, otherwise undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setConfigError](#action-setconfigerror)                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setRuntimePlugins](#action-setruntimeplugins)             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setSessionPlugins](#action-setsessionplugins)             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setConfigAndPlugins](#action-setconfigandplugins)         | Actions    | Commits config + plugins in a single action so reactions never observe runtimePlugins set while configSnapshot is still undefined (which would build the rootModel with `jbrowse: undefined`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setSessionTriaged](#action-setsessiontriaged)             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setSessionSource](#action-setsessionsource)               | Actions    | Sets the resolved session that the build will apply. Producer of every loadSessionByType branch; consumed once by initSession.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [buildPluginManager](#action-buildpluginmanager)           | Actions    | Builds the pluginManager (and rootModel) from the loaded config/session. Idempotent: a second call while one already exists is a no-op.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [disposePluginManager](#action-disposepluginmanager)       | Actions    | Tears down the rootModel. Saves the live session back into sessionSource first so HMR (which reuses this loader) can restore it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [loadConfigAndPlugins](#action-loadconfigandplugins)       | Actions    | Resolves a config: loads its plugin records, then commits them together with configSnapshot in a single action (setConfigAndPlugins) so `ready` never observes plugins-loaded-but-config-undefined.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [loadSession](#action-loadsession)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [fetchConfig](#action-fetchconfig)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [loadImportedSession](#action-loadimportedsession)         | Actions    | Loads a session that arrived from OUTSIDE this browser's local storage (a share link, a url-encoded/json session, or a triage-accepted session) and gives it a fresh local id. The new id makes it an independent local session, so opening the same external URL in two tabs doesn't make them autosave over each other. Contrast `fetchLocalSession`, which restores an already-local session and keeps its id. Pass `userAcceptedConfirmation` when the caller has shown the user a plugin triage dialog and they accepted.                                                                                                                                                                                               |
| [fetchLocalSession](#action-fetchlocalsession)             | Actions    | Restores the session named by the URL's `local-<id>`, tried in sessionStorage (this tab's current) then IndexedDB (shared autosave). A sessionStorage hit means this same tab is reloading its own session, so we keep id = query: the URL keeps pointing at a session this tab already persisted (a fresh id would race the debounced autosave -> "not found" on a fast refresh, and orphan a new IndexedDB entry every reload). An IndexedDB-only hit means another context (a new tab off a copied URL, a link, a fresh visit) is adopting an id this tab never owned. IndexedDB is shared across tabs, so we fork a fresh id via `loadImportedSession`; otherwise both tabs would autosave over the same slot and fight. |
| [fetchSharedSession](#action-fetchsharedsession)           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [decodeEncodedUrlSession](#action-decodeencodedurlsession) | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [decodeJsonUrlSession](#action-decodejsonurlsession)       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [decodeSessionSpec](#action-decodesessionspec)             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [decodeJb1StyleSession](#action-decodejb1stylesession)     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [decodeHubSpec](#action-decodehubspec)                     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [loadSessionByType](#action-loadsessionbytype)             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [loadConfig](#action-loadconfig)                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [applyTriagedConfig](#action-applytriagedconfig)           | Actions    | Commits a config snapshot that was surfaced via triage: loads its plugins with a fresh id, clears the (config) triage, then resolves the session. Session loading is deferred to here — `initialize` skips it while a config triage is pending — so the session resolves against the committed config and an untrusted session can't clobber the still-pending config triage (which would otherwise leave the config uncommitted and `ready` stuck). loadSessionByType may itself surface a new (session) triage.                                                                                                                                                                                                            |
| [initialize](#action-initialize)                           | Actions    | A config error short-circuits session loading: the try/catch sits at this level so loadSessionByType is skipped on config failure.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [activate](#action-activate)                               | Actions    | Attaches a React host: kicks off the one-time config/session load and starts an autorun that fires `buildPluginManager` once `ready` flips true. Idempotent — a second call while already activated is a no-op, and the load only ever runs once (see initializeStarted). Loading lives here rather than in afterCreate so model construction stays side-effect-free and safe under StrictMode's double-invoked useState initializer.                                                                                                                                                                                                                                                                                        |
| [deactivate](#action-deactivate)                           | Actions    | Detaches the React host: stops the build autorun and disposes the rootModel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

<details>
<summary>SessionLoader - Properties</summary>

#### property: extendSession

when true, jb1-style URL params (loc/tracks/highlight/...) navigate within the
configured defaultSession instead of replacing it

```ts
// type signature
type extendSession = IMaybe<ISimpleType<boolean>>
// code
extendSession: types.maybe(types.boolean)
```

#### property: sessionSource

the single resolved session, also the HMR/reload restore vehicle (preset to a
`snapshot` variant when rebuilding from a live session)

```ts
// type signature
type sessionSource = IType<
  SessionSource | null | undefined,
  SessionSource | undefined,
  SessionSource | undefined
>
// code
sessionSource: types.frozen<SessionSource | undefined>(undefined)
```

</details>

<details>
<summary>SessionLoader - Properties (other undocumented members)</summary>

#### property: configPath

```ts
// type signature
type configPath = IMaybe<ISimpleType<string>>
// code
configPath: types.maybe(types.string)
```

#### property: sessionQuery

```ts
// type signature
type sessionQuery = IMaybe<ISimpleType<string>>
// code
sessionQuery: types.maybe(types.string)
```

#### property: password

```ts
// type signature
type password = IMaybe<ISimpleType<string>>
// code
password: types.maybe(types.string)
```

#### property: adminKey

```ts
// type signature
type adminKey = IMaybe<ISimpleType<string>>
// code
adminKey: types.maybe(types.string)
```

#### property: loc

```ts
// type signature
type loc = IMaybe<ISimpleType<string>>
// code
loc: types.maybe(types.string)
```

#### property: sessionTracks

```ts
// type signature
type sessionTracks = IMaybe<ISimpleType<string>>
// code
sessionTracks: types.maybe(types.string)
```

#### property: assembly

```ts
// type signature
type assembly = IMaybe<ISimpleType<string>>
// code
assembly: types.maybe(types.string)
```

#### property: tracks

```ts
// type signature
type tracks = IMaybe<ISimpleType<string>>
// code
tracks: types.maybe(types.string)
```

#### property: tracklist

```ts
// type signature
type tracklist = IMaybe<ISimpleType<boolean>>
// code
tracklist: types.maybe(types.boolean)
```

#### property: highlight

```ts
// type signature
type highlight = IMaybe<ISimpleType<string>>
// code
highlight: types.maybe(types.string)
```

#### property: nav

```ts
// type signature
type nav = IMaybe<ISimpleType<boolean>>
// code
nav: types.maybe(types.boolean)
```

#### property: sessionName

```ts
// type signature
type sessionName = IMaybe<ISimpleType<string>>
// code
sessionName: types.maybe(types.string)
```

#### property: initialTimestamp

```ts
// type signature
type initialTimestamp = ISimpleType<number>
// code
initialTimestamp: types.number
```

#### property: hubURL

```ts
// type signature
type hubURL = IMaybe<IArrayType<ISimpleType<string>>>
// code
hubURL: types.maybe(types.array(types.string))
```

#### property: configSnapshot

```ts
// type signature
type configSnapshot = IType<
  Snap | null | undefined,
  Snap | undefined,
  Snap | undefined
>
// code
configSnapshot: types.frozen<Snap | undefined>(undefined)
```

</details>

<details>
<summary>SessionLoader - Volatiles</summary>

#### volatile: initializeStarted

guards initialize() to run exactly once per loader, even across the
activate/deactivate/activate cycle StrictMode drives on mount. Not reset by
deactivate (unlike buildAutorunDisposer) so a remount never refetches.

```ts
// type signature
type initializeStarted = false
// code
initializeStarted: false
```

</details>

<details>
<summary>SessionLoader - Volatiles (other undocumented members)</summary>

#### volatile: sessionTriaged

```ts
// type signature
type sessionTriaged = undefined
// code
sessionTriaged: undefined
```

#### volatile: runtimePlugins

```ts
// type signature
type runtimePlugins = undefined
// code
runtimePlugins: undefined
```

#### volatile: sessionPlugins

```ts
// type signature
type sessionPlugins = undefined
// code
sessionPlugins: undefined
```

#### volatile: configError

```ts
// type signature
type configError = undefined
// code
configError: undefined
```

#### volatile: pluginManager

```ts
// type signature
type pluginManager = undefined
// code
pluginManager: undefined
```

#### volatile: pluginManagerError

```ts
// type signature
type pluginManagerError = undefined
// code
pluginManagerError: undefined
```

#### volatile: buildAutorunDisposer

```ts
// type signature
type buildAutorunDisposer = undefined
// code
buildAutorunDisposer: undefined
```

</details>

<details>
<summary>SessionLoader - Getters</summary>

#### getter: sessionQueryType

the `session=` URL param's type prefix (`share`/`spec`/`encoded`/`json`/
`local`), or undefined when there's no recognized prefix. Mirrors the prefixes
stripped by stripPrefix()

```ts
type sessionQueryType = string | undefined
```

#### getter: extendDefaultSession

reads the opt-in `&extendSession=true` URL param that makes jb1-style params
layer onto the configured defaultSession instead of replacing it

```ts
type extendDefaultSession = boolean
```

#### getter: defaultSessionViewInit

URL-derived init (loc/tracks/highlight/...) applied onto the defaultSession's
first view when `extendDefaultSession` is enabled, otherwise undefined

```ts
type defaultSessionViewInit =
  | {
      loc: string | undefined
      assembly: string | undefined
      tracks: string[] | undefined
      tracklist: boolean | undefined
      nav: boolean | undefined
      highlight: string[] | undefined
    }
  | undefined
```

</details>

<details>
<summary>SessionLoader - Getters (other undocumented members)</summary>

#### getter: isHubSession

```ts
type isHubSession = boolean
```

#### getter: isJb1StyleSession

```ts
type isJb1StyleSession = boolean
```

#### getter: pluginsLoaded

```ts
type pluginsLoaded = boolean
```

#### getter: isSessionLoaded

```ts
type isSessionLoaded = boolean
```

#### getter: sessionTracksParsed

```ts
type sessionTracksParsed = Record<string, unknown>[]
```

#### getter: resolvedConfigPath

```ts
type resolvedConfigPath = string
```

#### getter: ready

```ts
type ready = boolean
```

</details>

<details>
<summary>SessionLoader - Actions</summary>

#### action: setConfigAndPlugins

Commits config + plugins in a single action so reactions never observe
runtimePlugins set while configSnapshot is still undefined (which would build
the rootModel with `jbrowse: undefined`).

```ts
type setConfigAndPlugins = (snap: Snap, plugins: PluginRecord[]) => void
```

#### action: setSessionSource

Sets the resolved session that the build will apply. Producer of every
loadSessionByType branch; consumed once by initSession.

```ts
type setSessionSource = (source: SessionSource) => void
```

#### action: buildPluginManager

Builds the pluginManager (and rootModel) from the loaded config/session.
Idempotent: a second call while one already exists is a no-op.

```ts
type buildPluginManager = (reloadCallback: ReloadPluginManagerCallback) => void
```

#### action: disposePluginManager

Tears down the rootModel. Saves the live session back into sessionSource first
so HMR (which reuses this loader) can restore it.

```ts
type disposePluginManager = () => void
```

#### action: loadConfigAndPlugins

Resolves a config: loads its plugin records, then commits them together with
configSnapshot in a single action (setConfigAndPlugins) so `ready` never
observes plugins-loaded-but-config-undefined.

```ts
type loadConfigAndPlugins = (
  snap: Snap & { plugins?: PluginDefinition[] | undefined },
) => Promise<void>
```

#### action: loadImportedSession

Loads a session that arrived from OUTSIDE this browser's local storage (a share
link, a url-encoded/json session, or a triage-accepted session) and gives it a
fresh local id. The new id makes it an independent local session, so opening the
same external URL in two tabs doesn't make them autosave over each other.
Contrast `fetchLocalSession`, which restores an already-local session and keeps
its id. Pass `userAcceptedConfirmation` when the caller has shown the user a
plugin triage dialog and they accepted.

```ts
type loadImportedSession = (
  session: Snap,
  userAcceptedConfirmation?: boolean | undefined,
) => Promise<void>
```

#### action: fetchLocalSession

Restores the session named by the URL's `local-<id>`, tried in sessionStorage
(this tab's current) then IndexedDB (shared autosave).

A sessionStorage hit means this same tab is reloading its own session, so we
keep id = query: the URL keeps pointing at a session this tab already persisted
(a fresh id would race the debounced autosave -> "not found" on a fast refresh,
and orphan a new IndexedDB entry every reload).

An IndexedDB-only hit means another context (a new tab off a copied URL, a link,
a fresh visit) is adopting an id this tab never owned. IndexedDB is shared
across tabs, so we fork a fresh id via `loadImportedSession`; otherwise both
tabs would autosave over the same slot and fight.

```ts
type fetchLocalSession = () => Promise<void>
```

#### action: applyTriagedConfig

Commits a config snapshot that was surfaced via triage: loads its plugins with a
fresh id, clears the (config) triage, then resolves the session. Session loading
is deferred to here — `initialize` skips it while a config triage is pending —
so the session resolves against the committed config and an untrusted session
can't clobber the still-pending config triage (which would otherwise leave the
config uncommitted and `ready` stuck). loadSessionByType may itself surface a
new (session) triage.

```ts
type applyTriagedConfig = (snap: Snap) => Promise<void>
```

#### action: initialize

A config error short-circuits session loading: the try/catch sits at this level
so loadSessionByType is skipped on config failure.

```ts
type initialize = () => Promise<void>
```

#### action: activate

Attaches a React host: kicks off the one-time config/session load and starts an
autorun that fires `buildPluginManager` once `ready` flips true. Idempotent — a
second call while already activated is a no-op, and the load only ever runs once
(see initializeStarted). Loading lives here rather than in afterCreate so model
construction stays side-effect-free and safe under StrictMode's double-invoked
useState initializer.

```ts
type activate = (reloadCallback: ReloadPluginManagerCallback) => void
```

#### action: deactivate

Detaches the React host: stops the build autorun and disposes the rootModel.

```ts
type deactivate = () => void
```

</details>

<details>
<summary>SessionLoader - Actions (other undocumented members)</summary>

#### action: setConfigError

```ts
type setConfigError = (error: unknown) => void
```

#### action: setRuntimePlugins

```ts
type setRuntimePlugins = (plugins: PluginRecord[]) => void
```

#### action: setSessionPlugins

```ts
type setSessionPlugins = (plugins: PluginRecord[]) => void
```

#### action: setSessionTriaged

```ts
type setSessionTriaged = (args?: SessionTriagedInfo | undefined) => void
```

#### action: loadSession

```ts
type loadSession = (
  snap: { sessionPlugins?: PluginDefinition[] | undefined; id: string },
  userAcceptedConfirmation?: boolean | undefined,
) => Promise<void>
```

#### action: fetchConfig

```ts
type fetchConfig = () => Promise<void>
```

#### action: fetchSharedSession

```ts
type fetchSharedSession = () => Promise<void>
```

#### action: decodeEncodedUrlSession

```ts
type decodeEncodedUrlSession = () => Promise<void>
```

#### action: decodeJsonUrlSession

```ts
type decodeJsonUrlSession = () => Promise<void>
```

#### action: decodeSessionSpec

```ts
type decodeSessionSpec = () => void
```

#### action: decodeJb1StyleSession

```ts
type decodeJb1StyleSession = () => void
```

#### action: decodeHubSpec

```ts
type decodeHubSpec = () => void
```

#### action: loadSessionByType

```ts
type loadSessionByType = () => Promise<void>
```

#### action: loadConfig

```ts
type loadConfig = () => Promise<void>
```

</details>
