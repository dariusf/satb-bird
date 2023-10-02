
# wasm pitch detection setup

```sh
# Rust 1.72.0
cargo install wasm-pack
(cd pitch && cargo build && wasm-pack build --target web)
ln -snf pitch/pkg pkg
```

See [this example](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor#examples) for how AudioWorkletNode and AudioWorkletProcessor are related.

- The [processor](pitch-processor.js) runs off the main thread, must be defined in a separate file, and communicates bidirectionally with the node by sending messages.
- The [node](pitch-rust.js) is part of the AudioContext graph, runs on the main thread, and instantiates the processor internally.
- Mic input is connected to the node, and pitch detection events are generated via side effects.

Setup is from this [tutorial](https://www.toptal.com/webassembly/webassembly-rust-tutorial-web-audio).

- Standard Rust and [wasm-pack](https://rustwasm.github.io/wasm-pack/) are used to build a wasm module which wraps the [pitch-detection](https://github.com/alesgenova/pitch-detection) [crate](https://crates.io/crates/pitch-detection) ([demo](https://alesgenova.github.io/pitch-detection-app), [source](https://github.com/alesgenova/pitch-detection-app), [docs](https://docs.rs/pitch-detection/0.3.0/pitch_detection/)). There is also some shim code which the processor uses to load the wasm blob.
- When the node starts, it fetches the wasm module and sends it(s bytes) to the processor, which compiles and loads it using the shim.
- The node sends a message requesting pitch detection to start. The processor then instantiates the structures in the wasm module and buffers audio, sending detected pitches back as they arrive, which the node responds to on the main thread. This continues forever.

Other references

- [Another Rust/wasm implementation](https://bojandjurdjevic.com/2018/WASM-vs-JS-Realtime-pitch-detection/)
- [How YIN works](https://www.youtube.com/watch?v=W585xR3bjLM)
- [Autocorrelation](https://alexanderell.is/posts/tuner/)
- [Another](https://github.com/cwilso/PitchDetect)

# ml5.js

[ml5.js](https://learn.ml5js.org/#/reference/pitch-detection) used to be included. The underlying model, CREPE, is [state of the art](https://github.com/marl/crepe). However, ml5.js requires modifications, as it 1. blocks the main thread when initializing, 2. [uses deprecated APIs](https://github.com/ml5js/ml5-library/blob/main/src/PitchDetection/index.js#L66), 3. does not provide a way to disconnect the source it creates, which is problematic for switching pitch detection methods. CREPE also has some [caveats](https://marl.github.io/crepe/) when used on the web that need to be accounted for.
