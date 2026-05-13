import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config GfaServerAdapter
 *
 * HTTP-based pangenome adapter. Talks to a graph-server (tools/graph-server)
 * that runs odgi locally to extract subgraphs and compute path-pair synteny
 * blocks. Replaces the static-file GfaTabixAdapter for prototyping and for
 * datasets where preprocessing the tabix index is impractical.
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const GfaServerAdapter = ConfigurationSchema(
  'GfaServerAdapter',
  {
    /**
     * #slot
     */
    serverUrl: {
      type: 'string',
      description:
        'Base URL of the graph-server, e.g. http://localhost:5001 (no trailing slash, no /api/v0)',
      defaultValue: 'http://localhost:5001',
    },
    /**
     * #slot
     */
    datasetId: {
      type: 'string',
      description:
        'Dataset id known to the server (matches the id field in the server datasets.json)',
      defaultValue: '',
    },
    /**
     * #slot
     */
    assemblyNameMap: {
      type: 'frozen',
      defaultValue: {},
      description:
        'Map from server-side genome names (e.g. GRCh38#0) to JBrowse assembly names (e.g. hg38)',
    },
  },
  { explicitlyTyped: true },
)

export default GfaServerAdapter
