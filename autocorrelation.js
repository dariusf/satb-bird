// import freqTable from './notes.js';

let Autocorrelation = (function () {
  // https://developer.microsoft.com/en-us/microsoft-edge/testdrive/demos/webaudiotuner

  // TODO oscillator also specifies this
  // const baseFreq = 440;

  // let notesArray = FREQ_TABLE; // freqTable[baseFreq];
  let sourceAudioNode;
  let analyserAudioNode;
  let audioContext;
  let frameId;

  let micStream;

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

  function detectPitch() {
    var buffer = new Uint8Array(analyserAudioNode.fftSize);
    analyserAudioNode.getByteTimeDomainData(buffer);

    var fundamentalFreq = findFundamentalFreq(buffer, audioContext.sampleRate);

    onPitch(interpretFreq(fundamentalFreq));

    frameId = window.requestAnimationFrame(detectPitch);
  }

  function stop() {
    if (sourceAudioNode && sourceAudioNode.mediaStream && sourceAudioNode.mediaStream.stop) {
      sourceAudioNode.mediaStream.stop();

      // TODO probably not needed?
      // sourceAudioNode.mediaStream.getAudioTracks().forEach(t => t.stop());
    }
    sourceAudioNode = null;
    analyserAudioNode = null;
    window.cancelAnimationFrame(frameId);
  }

  // stream is the return value of getUserMedia
  // idempotent and safe to call more than once
  function start() {
    analyserAudioNode = audioContext.createAnalyser();
    analyserAudioNode.fftSize = 2048;

    sourceAudioNode = audioContext.createMediaStreamSource(micStream);
    sourceAudioNode.connect(analyserAudioNode);

    detectPitch();
  }

  function init(audioCtx, onPitchDetected, stream) {
    // if (!isGetUserMediaSupported()) {
    //   throw (
    //     'It looks like this browser does not support getUserMedia. ' +
    //     'Check <a href="http://caniuse.com/#feat=stream">http://caniuse.com/#feat=stream</a> for more info.'
    //   );
    // }
    // if (isAudioContextSupported()) {
    audioContext = audioCtx;
    // new AudioContext();
    // } else {
    //   throw 'AudioContext is not supported in this browser.';
    // }
    onPitch = onPitchDetected;

    micStream = stream;
  }

  return { init, start, stop };
})();
