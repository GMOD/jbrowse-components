"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkStopToken = checkStopToken;
function isWebWorker() {
    return (typeof WorkerGlobalScope !== 'undefined' &&
        self instanceof WorkerGlobalScope);
}
function checkStopToken(stopToken) {
    if (typeof jest === 'undefined' && stopToken !== undefined && isWebWorker()) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', stopToken, false);
        try {
            xhr.send(null);
        }
        catch (e) {
            throw new Error('aborted');
        }
    }
}
