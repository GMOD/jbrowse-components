---
id: assembliesmixin
title: AssembliesMixin
description: "Adds sessionAssemblies (admin-aware, persisted-with-session assemblies) and temporaryAssemblies (used for ad-hoc read-vs-ref style assemblies)."
sidebar_label: Mixin -> AssembliesMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/Assemblies/AssembliesMixin.ts).

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
| <span id="getter-assemblies">**assemblies**</span><br><code><a href="../../config/baseassembly">BaseAssemblyConfig</a>[]</code> | sessionAssemblies plus jbrowse config assemblies. Does not include temporaryAssemblies; this is the list shown in the AssemblySelector dropdown. |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> | names of the assemblies returned by the `assemblies` getter |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-findassemblyconf">**findAssemblyConf**</span><br><code>(name: string) =&gt; <a href="../../config/baseassembly">BaseAssemblyConfig</a> &#124; undefined</code> | The assembly config whose name or one of whose aliases is `name`, from any of the three arrays the assemblyManager draws on, or undefined.<br><br>One namespace, because `name` is the assembly config's MST identifier: a second config with a name one of the others already has doesn't fail at the add, it makes every `assembly.configuration` safeReference in the manager ambiguous, and MST then throws on every read of one — inside the manager's own autorun and inside `assemblyNameMap`, which takes the session down. So each add path checks all three, not just the array it pushes to. Aliases count too: a new assembly named `GRCh38` beside an `hg38` aliased `GRCh38` would leave `get('GRCh38')` to array order. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-addsessionassembly">**addSessionAssembly**</span><br><code>(conf: AnyConfiguration) =&gt; <a href="../../config/baseassembly">BaseAssemblyConfig</a></code> |  |
| <span id="action-addassembly">**addAssembly**</span><br><code>(conf: AnyConfiguration) =&gt; void</code> |  |
| <span id="action-removeassembly">**removeAssembly**</span><br><code>(name: string) =&gt; void</code> |  |
| <span id="action-removesessionassembly">**removeSessionAssembly**</span><br><code>(assemblyName: string) =&gt; void</code> |  |
| <span id="action-addtemporaryassembly">**addTemporaryAssembly**</span><br><code>(conf: AnyConfiguration) =&gt; <a href="../../config/baseassembly">BaseAssemblyConfig</a></code> | used for read vs ref type assemblies. |
| <span id="action-removetemporaryassembly">**removeTemporaryAssembly**</span><br><code>(name: string) =&gt; void</code> |  |
