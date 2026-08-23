---
id: assemblymanager
title: AssemblyManager
sidebar_label: Assembly Management -> AssemblyManager
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/assemblyManager/assemblyManager.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-assemblies">**assemblies**</span><br><code>assemblies: types.array(assemblyFactory(conf, pm))</code> | this is automatically managed by an autorun which looks in the parent session.assemblies, session.sessionAssemblies, and session.temporaryAssemblies |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-unrecognizedreports">**unrecognizedReports**</span><br><code>unrecognizedReports: createUnrecognizedAssemblyReports()</code> | rate limiter for `get`'s `Core-handleUnrecognizedAssembly` reports, so each unknown name reaches the extension point once per session |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-assemblynamemap">**assemblyNameMap**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>Record&lt;string, ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; lo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>Record&lt;string, ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; loadingP: Promise&lt;…&gt; &#124; undefined; ... 10 more ...; refNameMismatches: Map&lt;…&gt;; } &amp; ... 13 more ... &amp; IStateTreeNode&lt;…&gt;&gt;</code></pre></dialog></span> |  |
| <span id="getter-assemblynameslist">**assemblyNamesList**</span><br><code>string[]</code> | read via readConfObject, matching how the afterAttach autorun names the assemblies it creates: get() treats a name found here as "a config exists, its model is just not built yet", so the two must agree |
| <span id="getter-configuredassemblynames">**configuredAssemblyNames**</span><br><code>Set&lt;string&gt;</code> | Every name the *configs* answer to — each assembly's `name` and its `aliases`. What has knows before the models exist.<br><br>Separate from assemblyNamesList rather than widening it: `get` treats a name found in that list as "a config exists, its model is just not built yet", which has to stay the canonical name the autorun will create the assembly under. A Set because `has` is called per name by per-render scans over every track in the session. |
| <span id="getter-assemblylist">**assemblyList**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | combined jbrowse.assemblies, session.sessionAssemblies, and session.temporaryAssemblies |
| <span id="getter-rpcmanager">**rpcManager**</span><br><code>RpcManager</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-getcanonicalassemblyname">**getCanonicalAssemblyName**</span><br><code>(asmName: string) =&gt; string</code> |  |
| <span id="method-getdisplayname">**getDisplayName**</span><br><code>(asmName: string) =&gt; string</code> |  |
| <span id="method-get">**get**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(asmName: string) =&gt; (ModelInstanceTypeProps&lt;…&gt; &amp; { error: unkn…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(asmName: string) =&gt; (ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; ... 11 more ...; refNameMismatches: Map&lt;...&gt;; } &amp; ... 13 more ... &amp; IStateTreeNode&lt;...&gt;) &#124; undefined</code></pre></dialog></span> | The assembly `asmName` names, or undefined. Reports a name it doesn't know to `Core-handleUnrecognizedAssembly` so a plugin can go supply it, which is a side effect: a caller only asking *whether* the session has the assembly wants has instead. Each name is reported at most once per session, since a handler resolves it out of band and the assembly turning up is itself the reactive signal. |
| <span id="method-has">**has**</span><br><code>(asmName: string) =&gt; boolean</code> | Whether the session knows this assembly. Use this, not `get`, to ask only whether the assembly is present: `!has(name)` is exactly the condition under which `get` reports `name` to `Core-handleUnrecognizedAssembly`, so probing with `get` tells every installed plugin to go resolve a name that a caller supplying the assembly itself (a hub connection, MAF row navigation) is about to create. |
| <span id="method-loadingassembly">**loadingAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(asmNames: string[]) =&gt; (ModelInstanceTypeProps&lt;…&gt; &amp; { error: u…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(asmNames: string[]) =&gt; (ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; ... 11 more ...; refNameMismatches: Map&lt;...&gt;; } &amp; ... 13 more ... &amp; IStateTreeNode&lt;...&gt;) &#124; undefined</code></pre></dialog></span> | The first of `asmNames` that hasn't finished loading — the one a view blocked on them is waiting for, and whose `statusMessage` / `statusProgress` its spinner should show. Returns the assembly itself (a stable reference, so a consuming getter doesn't invalidate on every read) or undefined once they are all loaded. |
| <span id="method-settleassemblyresolution">**settleAssemblyResolution**</span><br><code>(assemblyName: string) =&gt; Promise&lt;void&gt;</code> | Wait out whatever might still be about to supply `assemblyName`, and resolve once nothing is.<br><br>Resolution is a chain of events, not a duration: a handler probes and adds a connection, the connection fetches a config, the config's assemblies land in the session. Each link is observable, so each is waited on rather than guessed at.<br><br>- the handler's own promise, if it returned one, covers the part before the session gains anything to watch (the hubs plugin's HEAD probe) - any connection still fetching could be carrying the assembly, so its `loading` flag going false is the next event. Every loading connection counts, not just one naming this assembly: a connection config need not declare what it will turn out to provide, and waiting for one connection too many costs a moment while missing one returns the wrong answer.<br><br>A handler that returned nothing gets UNDECLARED_HANDLER_GRACE_MS instead, because it left nothing to wait on. |
| <span id="method-waitforassembly">**waitForAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string) =&gt; Promise&lt;(ModelInstanceTypeProps&lt;{ con…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string) =&gt; Promise&lt;(ModelInstanceTypeProps&lt;{ configuration: IMaybe&lt;IReferenceType&lt;IAnyType&gt;&gt;; }&gt; &amp; { ...; } &amp; ... 13 more ... &amp; IStateTreeNode&lt;...&gt;) &#124; undefined&gt;</code></pre></dialog></span> | use this method instead of assemblyManager.get(assemblyName) to get an assembly with regions loaded |
| <span id="method-requireassembly">**requireAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string) =&gt; Promise&lt;ModelInstanceTypeProps&lt;…&gt; &amp; {…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string) =&gt; Promise&lt;ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; ... 11 more ...; refNameMismatches: Map&lt;...&gt;; } &amp; ... 13 more ... &amp; IStateTreeNode&lt;...&gt;&gt;</code></pre></dialog></span> | waitForAssembly, but a name that cannot be resolved is an error rather than an `undefined` for the caller to interpret.<br><br>For callers whose result is silently *wrong* without the assembly, not merely absent: a refName map is the obvious one, since an empty map means an adapter gets queried with un-renamed refNames, finds nothing, and the track draws blank with nothing to say why. Failing here instead puts the name in front of the user, who is the only one who can add the assembly or fix the track.<br><br>Worth using only because the wait is causal now. It used to give up after a fixed ten seconds, where "not resolved" could equally mean "not resolved yet" and throwing would have been a race; today it returns only once every handler and connection that could supply the name has finished, so there is a real answer to report. |
| <span id="method-getrefnamemapforadapter">**getRefNameMapForAdapter**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(adapterConf: AdapterConf, assemblyName: string &#124; undefined, op…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(adapterConf: AdapterConf, assemblyName: string &#124; undefined, opts: AssemblyBaseOpts) =&gt; Promise&lt;RefNameAliases&gt;</code></pre></dialog></span> | The refName map for an adapter under `assemblyName`. Throws if the assembly cannot be resolved — see requireAssembly. No `assemblyName` at all is not a failure, just nothing to rename. |
| <span id="method-isvalidrefname">**isValidRefName**</span><br><code>(refName: string, assemblyName: string) =&gt; boolean</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-removeassembly">**removeAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(asm: ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; loadingP: P…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(asm: ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; loadingP: Promise&lt;…&gt; &#124; undefined; ... 10 more ...; refNameMismatches: Map&lt;…&gt;; } &amp; ... 13 more ... &amp; IStateTreeNode&lt;...&gt;) =&gt; void</code></pre></dialog></span> | private: you would generally want to add to manipulate jbrowse.assemblies, session.sessionAssemblies, or session.temporaryAssemblies instead of using this directly |
| <span id="action-addassembly">**addAssembly**</span><br><code>(configuration: any) =&gt; void</code> | private: you would generally want to add to manipulate jbrowse.assemblies, session.sessionAssemblies, or session.temporaryAssemblies instead of using this directly<br><br>this can take an active instance of an assembly, in which case it is referred to, or it can take an identifier e.g. assembly name, which is used as a reference. snapshots cannot be used |
