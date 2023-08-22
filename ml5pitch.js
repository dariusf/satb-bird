let ML5Pitch = (function () {
  function stop() {
    // if (sourceAudioNode && sourceAudioNode.mediaStream && sourceAudioNode.mediaStream.stop) {
    //   sourceAudioNode.mediaStream.stop();
    //   // TODO probably not needed?
    //   // sourceAudioNode.mediaStream.getAudioTracks().forEach(t => t.stop());
    // }
    // sourceAudioNode = null;
    // analyserAudioNode = null;
    // window.cancelAnimationFrame(frameId);
  }

  let pitchDetection;

  // stream is the return value of getUserMedia
  // idempotent and safe to call more than once
  function start() {
    pitchDetection.getPitch((err, frequency) => {
      if (err) {
        console.warn(err);
      }
      if (frequency) {
        onPitch(interpretFreq(frequency));
      }
      start();
    });
  }

  function init(audioCtx, onPitchDetected, stream) {
    audioContext = audioCtx;
    onPitch = onPitchDetected;
    micStream = stream;

    pitchDetection = ml5.pitchDetection('./model', audioContext, micStream, () => {
      console.log('pitch detection model loaded');
    });
  }

  return { init, start, stop };
})();
