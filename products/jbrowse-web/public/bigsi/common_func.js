const murmur = require('murmurhash-js')
const { BloomFilter } = require('bloom-filters')
const { IndexedFasta } = require('@gmod/indexedfasta')

function zeroPad(num, places){
    const paddedString = String(num).padStart(places, '0')
    return paddedString
}

function bitStringToArrayBuffer(bitString) {

    // split the string into octets
    var pairs = bitString.match(/[\d]{1,8}/gi)

    // convert the octets to integers
    var integers = pairs.map(function(s) {
        return parseInt(s, 2);
    });

    var array = new Uint8Array(integers);

    return array.buffer;
}

/**
 * @param { number } rowNum - bigsi row number
 * @param { string } root - parent directory where bigsi is stored
 *
 * @returns { string } path - path of the row binary file 
 */
function makeBigsiRowPath(rowNum, root){
    const paddedRowNum = zeroPad(rowNum, 6)
    const rowPath = `${paddedRowNum.slice(0,3)}/${paddedRowNum.slice(3,6)}`
    const path = `${root}/${rowPath}`

    return path
}
async function loadFasta(fastaPath, faiPath){
    const seq = new IndexedFasta({
        path: fastaPath,
        faiPath: faiPath,
        chunkSizeLimit: 50000000
    });

    return seq
}

/**
 * @param { IndexedFasta } genome -  sequence object for the genome
 * @param { number } seqSizeThreshold - minimum size of sequence to filter
 *
 * @returns { array of strings } seqNames - filtered seq names
 */
async function getFilteredGenomeSeqs(genome, seqSizeThreshold=10**7){
    const seqNames = await genome.getSequenceList()

    const filteredSeqNames = []
    for (let i=0; i < seqNames.length; i++){
        const seqSize = await genome.getSequenceSize(seqNames[i])
        if (seqSize >= seqSizeThreshold){
            filteredSeqNames.push(seqNames[i])
        }
    }

    return filteredSeqNames
    
}

function reverseComplement(sequence){
    var reverseSeq=sequence.split('').reverse().join('')

    let COMPLEMENT_BASES = {'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G'},
        re = /[ATCG]/g;

    var revComplementSeq = reverseSeq.replace(re, function (sequence) {
        return COMPLEMENT_BASES[sequence]
    });

    return revComplementSeq
}

function extractMinimizers(seq){
    //seq: sequence string
    seq = seq.toUpperCase()

    const kmerSize = 16
    const windowSize = 100
    const seed = 42

    let minimizers = []
    let deque = [] // array of {hash, offset}
    let revSequence = reverseComplement(seq)
    for (i = 0; i < (seq.length - kmerSize + 1); i++){
        let currentWindowIndex = i - windowSize + 1
        let kmerHashFwd = murmur.murmur3(seq.slice(i,i+kmerSize), seed)
        let kmerHashBwd = murmur.murmur3(revSequence.slice(-(i+kmerSize), -i), seed)
        let kmerHash = Math.min(kmerHashFwd, kmerHashBwd)
        //console.log(kmerHash, seq.slice(i,i+kmerSize))

        while (deque.length != 0 && deque[0].offset <= i - windowSize){
            deque.shift()
        }

        while (deque.length != 0 && deque.slice(-1)[0].hash >= kmerHash)
        {
            deque.pop()
        }

        deque.push({'hash':kmerHash, 'offset':i})
        //console.log('deque', deque.slice(-1)[0])

        if (currentWindowIndex >= 0){
            if ( minimizers.length == 0 || minimizers.slice(-1)[0] != deque[0].hash )
            {
                minimizers.push(deque[0].hash)
                //console.log('bucketMinimizer', minimizers.slice(-1)[0])
            }
        }
    }

    return minimizers
}

function makeMinimizersBloomFilter(minimizers, sizeBloomFilter=160000){
    /* Inputs:
     *  minimizers -- array of minimizers
     *  sizeBloomfilter -- length of the Bloom filter (160k)
     *
     * Outputs:
     *  minimizersBloomFilter -- Bloom filter with inserted minimizers
     *
     */

    const minimizersBloomFilter = new BloomFilter(sizeBloomFilter, nbHashes=1)
    for (let i=0; i < minimizers.length; i++){
        minimizersBloomFilter.add(minimizers[i].toString())

    }
    return minimizersBloomFilter
}

module.exports = {
    zeroPad: zeroPad,
    bitStringToArrayBuffer: bitStringToArrayBuffer,
    makeBigsiRowPath: makeBigsiRowPath,
    loadFasta: loadFasta,
    extractMinimizers: extractMinimizers,
    reverseComplement: reverseComplement,
    makeMinimizersBloomFilter: makeMinimizersBloomFilter,
}
