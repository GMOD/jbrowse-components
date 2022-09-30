---
id: quickstart_web
title: JBrowse web quick start
toplevel: true
---

import Figure from './figure'
import config from '../docusaurus.config.json'

In this guide, we'll get an instance of JBrowse web running on your computer's browser.

Are you an **administrator**, or want to install via CLI to get access to configuration tools? Follow our [CLI quick start](../quickstart_cli).

Want JBrowse desktop? Follow our [JBrowse desktop quick start](../quickstart_desktop).

## Downloading manually

Download JBrowse 2 manually <a href={`https://github.com/GMOD/jbrowse-components/releases/download/${config.customFields.currentVersion}/jbrowse-web-${config.customFields.currentVersion}.zip`}>here</a>.

Once you have downloaded the ZIP file, extract it to the directory where you would like to have JBrowse 2.

### Checking the download

The directory where you downloaded JBrowse should look something like this:

```txt
jbrowse2/
├── asset-manifest.json
├── favicon.ico
├── index.html
├── manifest.json
├── robots.txt
├── static/
├── test_data/
└── version.txt
```

## Running JBrowse 2

JBrowse 2 requires a web server to run. It won't work if you try to directly
open the `index.html` in your web browser. We can use a simple server to check
that JBrowse 2 has been downloaded properly. Run

```sh-session
cd jbrowse2/
npx serve . # use npx serve -S . if you want to refer to symlinked data later on
```

which will start a web server in our JBrowse 2 directory.

Navigate to the location specified in the CLI's output (likely
`http://localhost:3000`).

Your page should look something like this:

<Figure caption="JBrowse 2 screen showing no configuration found" src="/img/config_not_found.png"/>

Click on the sample config to see JBrowse 2 running with a demo
configuration. It should look like this:

<Figure caption="JBrowse 2 screen with a sample configuration" src="/img/sample_config.png"/>

Congratulations! You're running JBrowse 2.

## Next steps

Now that JBrowse 2 is set up, you can configure it with your own genomes and
tracks. There are two ways you can configure JBrowse 2: with the JBrowse CLI
(guide [here](../tutorials/config_cli/)) or with JBrowse 2's built-in graphical
configuration editing (guide [here](../tutorials/config_gui/)).
