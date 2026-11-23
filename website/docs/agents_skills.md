---
title: Agent skills for JBrowse
sidebar_label: Skills
description:
  The agent skills the JBrowse repository keeps, what each one briefs an agent
  on, and how to install them in Claude Code, Codex or another agent that reads
  SKILL.md folders
---

The JBrowse repository keeps
[agent skills](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills),
folders with a `SKILL.md` that brief a coding agent before it writes a config,
picks hosted data, renders a view or drives a running JBrowse. The agent loads a
skill when a task matches its description, so after installing them you ask in
plain words.

| Skill                                                                                                          | Use it to                                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [jbrowse-authoring](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills/jbrowse-authoring)     | write a config or session spec, plot a file's fields with the grammar of graphics, and check it with the validator |
| [jbrowse-hosted-data](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills/jbrowse-hosted-data) | find a hosted assembly and its tracks                                                                              |
| [jbrowse-capture](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills/jbrowse-capture)         | render a view to an image and know when it finished drawing                                                        |
| [jbrowse-mcp](https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills/jbrowse-mcp)                 | drive a running JBrowse: Desktop over its [MCP server](/docs/agents), or a JBrowse Web page through `window.jb`    |

## Install

The skills are mirrored at
[cmdcolin/jbrowse-skills](https://github.com/cmdcolin/jbrowse-skills) for
installing without the JBrowse repository. Copy them into your agent's skills
folder:

- `~/.agents/skills/`: Codex, Gemini CLI, Cursor and other agents that read
  `SKILL.md` folders
- `~/.claude/skills/`: Claude Code

```bash
mkdir -p ~/.agents/skills
curl -sL https://github.com/cmdcolin/jbrowse-skills/archive/refs/heads/main.tar.gz |
  tar -xz --strip-components=2 -C ~/.agents/skills jbrowse-skills-main/skills
```

Rerun it to update. An agent with a shell can do the same; ask it to install the
skills from https://github.com/cmdcolin/jbrowse-skills into its skills folder.

In JBrowse Web or Desktop, the **Command line** tab of **Help → Connect an AI
agent...** copies a prompt that has the agent follow jbrowse-authoring,
jbrowse-hosted-data and jbrowse-capture from GitHub without installing them.

## See also

- [](/docs/agents_authoring)
- [](/docs/agents_capture)
- [](/docs/agents_hosted_data)
