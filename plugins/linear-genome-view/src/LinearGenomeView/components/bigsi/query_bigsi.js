const cdf = require('binomial-cdf')
const matrix = require('matrix-js')
const commonFunc = require('./common_func.js')

async function makeQueryFragsMinimizers(querySeq, fragmentSize=2500){
    /* Inputs:
     *  querySeq -- query sequence string
     *  fragmentSize -- minimum size of fragments of query
     *
     * Outputs:
     *  queryFragmentsMinimizers -- an array of minimizer arrays for each fragment in the query
     *
     */

    const querySize = querySeq.length

    let queryFragmentsMinimizers = []

    if (querySize <= 300000 && querySize >= 5000){

        for (let n=0; n < Math.floor(querySize/fragmentSize); n++){
            const start = n*fragmentSize
            const end = Math.min(start + fragmentSize, querySize)
            const queryFragmentSeq = querySeq.slice(start, end)
            const queryFragmentMinimizers = commonFunc.extractMinimizers(queryFragmentSeq)
            queryFragmentsMinimizers.push(queryFragmentMinimizers)
        }
    }

    return queryFragmentsMinimizers
}

function makeQueryFragsBloomFilters(queryFragmentsMinimizers){
    /* Inputs:
     *  queryFragmentsMinimizers -- an array minimizer arrays for each fragment 
     *      in query
     *
     * Outputs:
     *  queryFragmentsBloomFilters -- an array of Bloom filters with fragment 
     *  minimizers inserted
     *
     */

    const queryFragmentsBloomFilters = []
    for (let j=0; j < queryFragmentsMinimizers.length; j++){
        const queryFragmentMinimizers = queryFragmentsMinimizers[j]

        const queryBloomFilter = commonFunc.makeMinimizersBloomFilter(queryFragmentMinimizers)
        queryFragmentsBloomFilters.push(queryBloomFilter)
    }

    return queryFragmentsBloomFilters
}

function getQueryBloomFilterOnesIndices(queryBloomFilter){
    return queryBloomFilter.reduce((indices, number, index) => {
        if (number != 0) indices.push(index)
        return indices
    }, [])

}

function initBigsiHits(seqSize, seqName, numBuckets=10, overhang=300000){
    /* Inputs:
     *  seqSize -- size of the sequence
     *  overhang -- bucket overhangs (equal to upper bound of query sequence length)
     *  numBuckets -- number of buckets for reference
     *
     * Outputs:
     *  bigsiHits -- object containing information for each bucket
     *      e.g { 0: {refName: "1", start: 0, end: 1, hits: 0 } }
     *
     */
    const bucketSize = Math.round(seqSize/(numBuckets-1))

    const bigsiHits = {} 
    for (let bucketNum=0; bucketNum < numBuckets; bucketNum++){
        bigsiHits[bucketNum] = {}

        if (bucketNum == 0){
            bigsiHits[bucketNum] = Object.assign(
                {
                    refName: seqName,
                    start: 0,
                    end: bucketSize,
                    hits: 0,
                }, 
                bigsiHits[bucketNum])
        } else {
            const intervalStart = (bucketNum*(bucketSize-overhang))+1
            let intervalEnd = intervalStart + bucketSize

            if (bucketNum == numBuckets - 1){
                intervalEnd = seqSize
            }

            bigsiHits[bucketNum] = Object.assign(
                {
                    refName: seqName,
                    start: intervalStart,
                    end: intervalEnd,
                    hits: 0,
                }, 
                bigsiHits[bucketNum]
            )
        }
    }

    return bigsiHits
}

function getBigsiSubmatrix(bigsi, rowFilter){
    /* Inputs:
     *  bigsi -- bigsi matrix
     *  rowFilter -- array of row indices to be extracted
     *
     * Outputs:
     *  submatrix -- resulting submatrix from extracting rows
     *
     */
    let submatrix = []
    for (i = 0; i < rowFilter.length; i++){
        const row = bigsi(rowFilter[i])
        submatrix.push(row)
    }

    submatrix = matrix(submatrix).trans()

    return submatrix

}

function computeSubmatrixHits(submatrix, bigsiHits, BFFalsePositiveProb=0.82, hitFalsePositiveProb=0.001){
    /* Inputs:
     *  submatrix -- bigsi array of arrays of hit rows
     *  bigsiHits -- object to store hits results for each bucket in bigsi
     *  BFFalsePositiveProb -- probability of a false positive for a Bloom Filter 
     *      query
     *  hitFalsePositiveProb -- set probability for the false positive of a hit
     *
     * Outputs:
     *  bigsiHits -- with updated hits property for each bucket
     *
     */
    const thresholdProbability = 1 - hitFalsePositiveProb

    for (let bucketNum = 0; bucketNum < submatrix.length; bucketNum++){
        rowsum = submatrix[bucketNum].reduce((a, b) => a + b, 0)
        const score = cdf(rowsum, submatrix[bucketNum].length, BFFalsePositiveProb)

        if (score >= thresholdProbability){
            bigsiHits[bucketNum]['hits'] += 1
        }
    }

}

async function queryBigsi(bigsi, queryFragmentsBloomFilters, bigsiHits){
    /* Inputs:
     *  bigsi -- bigsi matrix
     *  queryFragmentsBloomFilters -- an array of Bloom filters with fragment 
     *  minimizers inserted
     *
     * Outputs:
     *  filteredBigsiHits -- object containing fragment hits in the bigsi buckets
     *  
     */

    console.log('number of query BFs: ', queryFragmentsBloomFilters.length)

    for (let m = 0; m < queryFragmentsBloomFilters.length; m++){
        const queryBFOnesIndices = getQueryBloomFilterOnesIndices(queryFragmentsBloomFilters[m]._filter)
        
        const querySubmatrix = getBigsiSubmatrix(bigsi, queryBFOnesIndices)
        computeSubmatrixHits(querySubmatrix, bigsiHits)
        
        
    }

    const filteredBigsiHits = Object.fromEntries(
        Object.entries(bigsiHits).filter(([key, value]) => value.hits > 0) 
    )

    return filteredBigsiHits
}

async function main(bigsi, querySeq){
    /* Inputs:
     *  bigsi -- bigsi JSON string
     *  querySeq -- query sequence string
     *
     * Outputs: 
     *  filteredBigsiHits -- object containing buckets with hits > 0
     *
     */

    const queryFragmentsMinimizers = await makeQueryFragsMinimizers(querySeq)
    const queryBloomFilter = await makeQueryFragsBloomFilters(queryFragmentsMinimizers)

    const refSeqName = '1'
    const refSeqSize = 248956422
    const bigsiHits = initBigsiHits(refSeqSize, refSeqName, numBuckets=10, overhang=30000)

    const bigsiMatrix = matrix(bigsi)
    const filteredBigsiHits = await queryBigsi(bigsiMatrix, queryBloomFilter, bigsiHits)

    return filteredBigsiHits
}

module.exports = {
    makeQueryFragsMinimizers: makeQueryFragsMinimizers,
    makeQueryFragsBloomFilters: makeQueryFragsBloomFilters,
    getQueryBloomFilterOnesIndices: getQueryBloomFilterOnesIndices,
    initBigsiHits: initBigsiHits,
    getBigsiSubmatrix: getBigsiSubmatrix,
    computeSubmatrixHits: computeSubmatrixHits,
    queryBigsi: queryBigsi,
    main: main,
}
