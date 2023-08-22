let ML5Pitch = (function () {
  let pitchDetection;
  let enabled = false;

  function stop() {
    enabled = false;
  }

  // stream is the return value of getUserMedia
  // idempotent and safe to call more than once
  function start() {
    enabled = true;

    function loop() {
      pitchDetection.getPitch((err, frequency) => {
        if (err) {
          console.warn(err);
        }
        if (enabled && frequency) {
          onPitch(interpretFreq(frequency));
        }
        loop();
      });
    }
    loop();
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
