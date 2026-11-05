import assert from 'node:assert/strict';
import {VoiceRecorder} from './public/voice-recorder.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
class Recorder {
  static isTypeSupported() { return true; }
  mimeType = 'audio/webm';
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({data: new Blob(['phrase'], {type: this.mimeType})});
      this.onstop?.();
    });
  }
}

let pause, quiet, stopTracks, stopWatcher, results, requests, resolveFirst, errors;
const voice = new VoiceRecorder({
  Recorder,
  ready: async () => {},
  getUserMedia: async () => ({getTracks: () => [{stop: () => stopTracks++}]}),
  watchPauses(stream, onPause) {
    pause = onPause;
    return {isQuiet: () => quiet, stop: () => stopWatcher++};
  },
  transcribe(blob, signal) {
    requests.push(signal);
    if (requests.length === 1) return new Promise(resolve => {resolveFirst = resolve;});
    return 'rook c6';
  },
  async interpret(text, color) {
    if (text === 'switch to black') return {status: 'color', nextColor: 'black'};
    assert.equal(color, 'black');
    return {status: 'placements', commands: [{type: 'place', square: 'c6', piece: 'r'}]};
  },
  onTranscript(text, color) { results.push({text, color}); },
  onState() {},
  onError(error) { errors.push(error); },
});

function reset() {
  quiet = false;
  stopTracks = stopWatcher = 0;
  results = [];
  requests = [];
  errors = [];
}

reset();
await voice.start(null, 'r');
assert.ok(pause());
await flush();
assert.equal(voice.state, 'recording');
assert.equal(stopTracks, 0);
assert.equal(pause(), false, 'Keep capturing while the prior phrase is pending');
resolveFirst('switch to black');
await flush();
assert.deepEqual(results, [{text: 'switch to black', color: null}]);
assert.equal(voice.state, 'recording');
assert.ok(pause());
await flush();
assert.deepEqual(results[1], {text: 'rook c6', color: 'black'});
assert.equal(voice.state, 'recording');
quiet = true;
voice.release('r');
await flush();
assert.equal(voice.state, 'idle');
assert.equal(requests.length, 2, 'Do not send trailing silence after a live result');
assert.equal(stopTracks, 1);
assert.equal(stopWatcher, 1);
assert.deepEqual(errors, []);

reset();
await voice.start(null);
assert.ok(pause());
await flush();
voice.finish();
await flush();
assert.equal(stopTracks, 1, 'Release the mic while the live result is pending');
assert.equal(requests.length, 1);
resolveFirst('switch to black');
await flush();
assert.deepEqual(results, [{text: 'switch to black', color: null}, {text: 'rook c6', color: 'black'}]);
assert.equal(voice.state, 'idle');
assert.deepEqual(errors, []);

reset();
await voice.start(null);
assert.ok(pause());
await flush();
const stalePause = pause;
voice.cancel();
resolveFirst('switch to black');
await flush();
assert.equal(stalePause(), false);
assert.equal(requests[0].aborted, true);
assert.deepEqual(results, []);
assert.deepEqual(errors, []);
assert.equal(voice.state, 'idle');

console.log('Live phrases apply while recording, preserve order and spoken color, flush the tail, and ignore cancelled results.');
