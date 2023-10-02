class PitchNode extends AudioWorkletNode {
  /**
   * Initialize the Audio processor by sending the fetched WebAssembly module to
   * the processor worklet.
   *
   * @param {ArrayBuffer} wasmBytes Sequence of bytes representing the entire
   * WASM module that will handle pitch detection.
   * @param {number} numAudioSamplesPerAnalysis Number of audio samples used
   * for each analysis. Must be a power of 2.
   */
  init(wasmBytes, onPitchDetectedCallback, numAudioSamplesPerAnalysis) {
    this.onPitchDetectedCallback = onPitchDetectedCallback;
    this.numAudioSamplesPerAnalysis = numAudioSamplesPerAnalysis;

    // Listen to messages sent from the audio processor.
    this.port.onmessage = (event) => this.onmessage(event.data);

    this.port.postMessage({
      type: 'send-wasm-module',
      wasmBytes,
    });
  }

  // Handle an uncaught exception thrown in the PitchProcessor.
  onprocessorerror(err) {
    console.log(`An error from AudioWorkletProcessor.process() occurred: ${err}`);
  }

  onmessage(event) {
    if (event.type === 'wasm-module-loaded') {
      // The Wasm module was successfully sent to the PitchProcessor running on the
      // AudioWorklet thread and compiled. This is our cue to configure the pitch
      // detector.
      this.port.postMessage({
        type: 'init-detector',
        sampleRate: this.context.sampleRate,
        numAudioSamplesPerAnalysis: this.numAudioSamplesPerAnalysis,
      });
    } else if (event.type === 'pitch') {
      // A pitch was detected. Invoke our callback which will result in the UI updating.
      this.onPitchDetectedCallback(event.pitch);
    }
  }
}

let WasmPitch = (function () {
  let source;
  let enabled = false;

  function stop() {
    enabled = false;
  }

  function start() {
    enabled = true;
  }

  async function init(audioCtx, onPitchDetected, stream) {
    onPitch = onPitchDetected;
    let mediaStream = stream;

    const audioSource = audioCtx.createMediaStreamSource(mediaStream);
    source = audioSource;

    let node;

    try {
      // Fetch the WebAssembly module that performs pitch detection.
      // const response = await window.fetch('wasm-audio/wasm_audio_bg.wasm');
      const response = await window.fetch('pkg/pitch_bg.wasm');
      const wasmBytes = await response.arrayBuffer();

      // Add our audio processor worklet to the context.
      const processorUrl = 'pitch-processor.js';
      try {
        await audioCtx.audioWorklet.addModule(processorUrl);
      } catch (e) {
        throw new Error(`Failed to load audio analyzer worklet at url: ${processorUrl}. Further info: ${e.message}`);
      }

      // Create the AudioWorkletNode which enables the main JavaScript thread to
      // communicate with the audio processor (which runs in a Worklet).
      node = new PitchNode(audioCtx, 'PitchProcessor');

      // numAudioSamplesPerAnalysis specifies the number of consecutive audio samples that
      // the pitch detection algorithm calculates for each unit of work. Larger values tend
      // to produce slightly more accurate results but are more expensive to compute and
      // can lead to notes being missed in faster passages i.e. where the music note is
      // changing rapidly. 1024 is usually a good balance between efficiency and accuracy
      // for music analysis.
      const numAudioSamplesPerAnalysis = 1024;

      // Send the Wasm module to the audio node which in turn passes it to the
      // processor running in the Worklet thread. Also, pass any configuration
      // parameters for the Wasm detection algorithm.
      node.init(
        wasmBytes,
        (freq) => {
          if (enabled) {
            onPitchDetected(interpretFreq(freq));
          }
        },
        numAudioSamplesPerAnalysis
      );

      // Connect the audio source (microphone output) to our analysis node.
      audioSource.connect(node);

      // Connect our analysis node to the output. Required even though we do not
      // output any audio. Allows further downstream audio processing or output to
      // occur.
      node.connect(audioCtx.destination);
    } catch (err) {
      throw new Error(`Failed to load audio analyzer WASM module. Further info: ${err.message}`);
    }

    return { node };
  }

  function destroy() {
    if (!source) {
      return;
    }
    source.disconnect();
  }

  return { init, start, stop, destroy };
})();
