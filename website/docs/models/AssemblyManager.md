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

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-assemblynamemap">**assemblyNameMap**</span><br><code>Record&lt;…&gt;</code> |  |
| <span id="getter-assemblynameslist">**assemblyNamesList**</span><br><code>string[]</code> | read via readConfObject, matching how the afterAttach autorun names the assemblies it creates: get() treats a name found here as "a config exists, its model is just not built yet", so the two must agree |
| <span id="getter-assemblylist">**assemblyList**</span><br><details><summary><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></summary><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></details> | combined jbrowse.assemblies, session.sessionAssemblies, and session.temporaryAssemblies |
| <span id="getter-rpcmanager">**rpcManager**</span><br><code>RpcManager</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-getcanonicalassemblyname">**getCanonicalAssemblyName**</span><br><code>(asmName: string) =&gt; string</code> |  |
| <span id="method-getdisplayname">**getDisplayName**</span><br><code>(asmName: string) =&gt; string</code> |  |
| <span id="method-get">**get**</span><br><details><summary><code>(asmName: string) =&gt; (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; ... 12…</code></summary><pre><code>(asmName: string) =&gt; (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; ... 12 more ... &amp; IStateTreeNode&lt;…&gt;) &#124; undefined</code></pre></details> |  |
| <span id="method-waitforassembly">**waitForAssembly**</span><br><details><summary><code>(assemblyName: string) =&gt; Promise&lt;(ModelInstanceTypeProps&lt;{ con…</code></summary><pre><code>(assemblyName: string) =&gt; Promise&lt;(ModelInstanceTypeProps&lt;{ configuration: IMaybe&lt;IReferenceType&lt;IAnyType&gt;&gt;; }&gt; &amp; { ...; } &amp; ... 12 more ... &amp; IStateTreeNode&lt;...&gt;) &#124; undefined&gt;</code></pre></details> | use this method instead of assemblyManager.get(assemblyName) to get an assembly with regions loaded |
| <span id="method-getrefnamemapforadapter">**getRefNameMapForAdapter**</span><br><details><summary><code>(adapterConf: AdapterConf, assemblyName: string &#124; undefined, op…</code></summary><pre><code>(adapterConf: AdapterConf, assemblyName: string &#124; undefined, opts: AssemblyBaseOpts) =&gt; Promise&lt;RefNameAliases&gt;</code></pre></details> |  |
| <span id="method-isvalidrefname">**isValidRefName**</span><br><code>(refName: string, assemblyName: string) =&gt; boolean</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-removeassembly">**removeAssembly**</span><br><details><summary><code>(asm: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; ... 12 more ... &amp; IStat…</code></summary><pre><code>(asm: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; ... 12 more ... &amp; IStateTreeNode&lt;…&gt;) =&gt; void</code></pre></details> | private: you would generally want to add to manipulate jbrowse.assemblies, session.sessionAssemblies, or session.temporaryAssemblies instead of using this directly |
| <span id="action-addassembly">**addAssembly**</span><br><code>(configuration: any) =&gt; void</code> | private: you would generally want to add to manipulate jbrowse.assemblies, session.sessionAssemblies, or session.temporaryAssemblies instead of using this directly<br><br>this can take an active instance of an assembly, in which case it is referred to, or it can take an identifier e.g. assembly name, which is used as a reference. snapshots cannot be used |
