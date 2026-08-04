---
id: assembliesmixin
title: AssembliesMixin
sidebar_label: Mixin -> AssembliesMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/Assemblies/AssembliesMixin.ts).

Adds `sessionAssemblies` (admin-aware, persisted-with-session assemblies) and
`temporaryAssemblies` (used for ad-hoc read-vs-ref style assemblies).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-sessionassemblies">**sessionAssemblies**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>sessionAssemblies: types.stripDefault( types.array(assemblyConf…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>sessionAssemblies: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.array(assemblyConfigSchemasType),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;[],&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-temporaryassemblies">**temporaryAssemblies**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>temporaryAssemblies: types.stripDefault( types.array(assemblyCo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>temporaryAssemblies: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.array(assemblyConfigSchemasType),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;[],&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-assemblies">**assemblies**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;string, unknown&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | sessionAssemblies plus jbrowse config assemblies. Does not include temporaryAssemblies; this is the list shown in the AssemblySelector dropdown. |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> | names of the assemblies returned by the `assemblies` getter |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-findassemblyconf">**findAssemblyConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(name: unknown) =&gt; (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTre…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(name: unknown) =&gt; (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) &#124; undefined</code></pre></dialog></span> | The assembly config already carrying `name`, from any of the three arrays the assemblyManager draws on, or undefined.<br><br>One namespace, because `name` is the assembly config's MST identifier: a second config carrying a name one of the others already has doesn't fail at the add, it makes every `assembly.configuration` safeReference in the manager ambiguous, and MST then throws on every read of one — inside the manager's own autorun and inside `assemblyNameMap`, which takes the session down. So each add path checks all three, not just the array it pushes to. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-addsessionassembly">**addSessionAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(conf: AnyConfiguration) =&gt; ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; I…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(conf: AnyConfiguration) =&gt; ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> |  |
| <span id="action-addassembly">**addAssembly**</span><br><code>(conf: AnyConfiguration) =&gt; void</code> |  |
| <span id="action-removeassembly">**removeAssembly**</span><br><code>(name: string) =&gt; void</code> |  |
| <span id="action-removesessionassembly">**removeSessionAssembly**</span><br><code>(assemblyName: string) =&gt; void</code> |  |
| <span id="action-addtemporaryassembly">**addTemporaryAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(conf: AnyConfiguration) =&gt; ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; I…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(conf: AnyConfiguration) =&gt; ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> | used for read vs ref type assemblies. |
| <span id="action-removetemporaryassembly">**removeTemporaryAssembly**</span><br><code>(name: string) =&gt; void</code> |  |
