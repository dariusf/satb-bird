let ML5Pitch = (function () {
  let pitchDetection;
  let enabled = false;

  function stop() {
    enabled = false;
  }

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

  async function init(audioCtx, onPitchDetected, stream) {
    audioContext = audioCtx;
    onPitch = onPitchDetected;
    micStream = stream;

    pitchDetection = await ml5.pitchDetection('./model', audioContext, micStream);
  }

  return { init, start, stop };
})();
