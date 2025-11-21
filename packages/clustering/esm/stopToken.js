function isWebWorker() {
    return (typeof WorkerGlobalScope !== 'undefined' &&
        self instanceof WorkerGlobalScope);
}
export function checkStopToken(stopToken) {
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
