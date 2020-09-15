import { flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import JBrowseCommand from '../base'

function isValidPort(port: number) {
  return (port > 0 && port < 65535)
}

export default class AdminServer extends JBrowseCommand {
  static description = 'Start up a small admin server for JBrowse configuration'

  static examples = [
    '$ jbrowse admin-server',
    '$ jbrowse admin-server -p 8888',
  ]

  static flags = {
    port: flags.string({
      char: 'p',
      description:
        'Specifified port to start the server on;\nDefault is 9090.',
    }),
    help: flags.help({ char: 'h' }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(AdminServer)
  
    // start server with admin key in URL query string
    let port = 9090
    if (runFlags.port && isValidPort(parseInt(runFlags.port))) {
      port = parseInt(runFlags.port);
    }
    console.log("Port: ", port)

    // save configan onSnapshot by POSTing it (authenticated and authorized by the admin key) to the admin server

  }

}
