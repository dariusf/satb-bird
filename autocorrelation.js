import { shaped } from './shaped.js';
import freqTable from "./notes.js";

// https://developer.microsoft.com/en-us/microsoft-edge/testdrive/demos/webaudiotuner

// TODO oscillator also specifies this
const baseFreq = 440;

let notesArray = freqTable[baseFreq];
let sourceAudioNode;
let analyserAudioNode;
let audioContext;
let frameId;

let micStream;
let lastNote;
let lastCents;

let onPitch;

function findFundamentalFreq(buffer, sampleRate) {
  // We use Autocorrelation to find the fundamental frequency.

  // In order to correlate the signal with itself (hence the name of the algorithm), we will check two points 'k' frames away.
  // The autocorrelation index will be the average of these products. At the same time, we normalize the values.
  // Source: http://www.phy.mty.edu/~suits/autocorrelation.html
  // Assuming the sample rate is 48000Hz, a 'k' equal to 1000 would correspond to a 48Hz signal (48000/1000 = 48),
  // while a 'k' equal to 8 would correspond to a 6000Hz one, which is enough to cover most (if not all)
  // the notes we have in the notes.json?_ts=1544049744514 file.
  var n = 1024;
  var bestK = -1;
  var bestR = 0;
  for (var k = 8; k <= 1000; k++) {
    var sum = 0;

    for (var i = 0; i < n; i++) {
      sum += ((buffer[i] - 128) / 128) * ((buffer[i + k] - 128) / 128);
    }

    var r = sum / (n + k);

    if (r > bestR) {
      bestR = r;
      bestK = k;
    }

    if (r > 0.9) {
      // Let's assume that this is good enough and stop right here
      break;
    }
  }

  if (bestR > 0.0025) {
    // The period (in frames) of the fundamental frequency is 'bestK'. Getting the frequency from there is trivial.
    var fundamentalFreq = sampleRate / bestK;
    return fundamentalFreq;
  } else {
    // We haven't found a good correlation
    return -1;
  }
}

function findClosestNote(freq, notes) {
  // Use binary search to find the closest note
  var low = -1;
  var high = notes.length;
  while (high - low > 1) {
    var pivot = Math.round((low + high) / 2);
    if (notes[pivot].frequency <= freq) {
      low = pivot;
    } else {
      high = pivot;
    }
  }

  if (
    Math.abs(notes[high].frequency - freq) <=
    Math.abs(notes[low].frequency - freq)
  ) {
    // notes[high] is closer to the frequency we found
    return notes[high];
  }

  return notes[low];
}

function findCentsOffPitch(freq, refFreq) {
  // We need to find how far freq is from baseFreq in cents
  var log2 = 0.6931471805599453; // Math.log(2)
  var multiplicativeFactor = freq / refFreq;

  // We use Math.floor to get the integer part and ignore decimals
  var cents = Math.floor(1200 * (Math.log(multiplicativeFactor) / log2));
  return cents;
}

function throttleOutput(note, cents) {
  shaped(note, String);
  shaped(cents, Number);
  if (note === lastNote && cents === lastCents) {
    return;
  }
  lastNote = note.note;
  lastCents = lastCents;
  const bug = "F#8"; // TODO hide any note outside the calibrated ranged
  if (note === "--") {
    onPitch({ note: null, cents: null });
  } else if (note === bug) {
    onPitch({ note: null, cents: null });
  } else {
    onPitch({ note, cents });
  }
}

function detectPitch() {
  var buffer = new Uint8Array(analyserAudioNode.fftSize);
  analyserAudioNode.getByteTimeDomainData(buffer);

  var fundalmentalFreq = findFundamentalFreq(buffer, audioContext.sampleRate);

  if (fundalmentalFreq !== -1) {
    var note = findClosestNote(fundalmentalFreq, notesArray);
    var cents = findCentsOffPitch(fundalmentalFreq, note.frequency);

    throttleOutput(note.note, cents);
  } else {
    throttleOutput("--", -50);
  }

  frameId = window.requestAnimationFrame(detectPitch);
}

function streamReceived(stream) {
  micStream = stream;

  analyserAudioNode = audioContext.createAnalyser();
  analyserAudioNode.fftSize = 2048;

  sourceAudioNode = audioContext.createMediaStreamSource(micStream);
  sourceAudioNode.connect(analyserAudioNode);

  detectPitch();
}

function stop() {
  if (
    sourceAudioNode &&
    sourceAudioNode.mediaStream &&
    sourceAudioNode.mediaStream.stop
  ) {
    sourceAudioNode.mediaStream.stop();

    // TODO probably not needed?
    // sourceAudioNode.mediaStream.getAudioTracks().forEach(t => t.stop());
  }
  sourceAudioNode = null;
  analyserAudioNode = null;
  window.cancelAnimationFrame(frameId);
}

function start() {
  // TODO required?

  //   if (audioContext.state === "suspended") {
  //     audioContext.resume();
  //   }

  let getUserMedia =
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      : function(constraints) {
          return new Promise(function(resolve, reject) {
            navigator.getUserMedia(constraints, resolve, reject);
          });
        };

  getUserMedia({ audio: true })
    .then(streamReceived)
    .catch(e => {
      // TODO is this what we do?
      throw e;
    });

  throttleOutput("C4", 0);
}

function init(f) {
  if (!isGetUserMediaSupported()) {
    throw "It looks like this browser does not support getUserMedia. " +
      'Check <a href="http://caniuse.com/#feat=stream">http://caniuse.com/#feat=stream</a> for more info.';
  }
  if (isAudioContextSupported()) {
    audioContext = new AudioContext();
  } else {
    throw "AudioContext is not supported in this browser.";
  }
  onPitch = f;
}

export default { init, start, stop };