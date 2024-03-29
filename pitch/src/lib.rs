use pitch_detection::detector::mcleod::McLeodDetector;
use pitch_detection::detector::autocorrelation::AutocorrelationDetector;
use pitch_detection::detector::yin::YINDetector;
use pitch_detection::detector::PitchDetector;
use wasm_bindgen::prelude::*;

pub fn set_panic_hook() {
  // When the `console_error_panic_hook` feature is enabled, we can call the
  // `set_panic_hook` function at least once during initialization, and then
  // we will get better error messages if our code ever panics.
  //
  // For more details see
  // https://github.com/rustwasm/console_error_panic_hook#readme
  #[cfg(feature = "console_error_panic_hook")]
  console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct WasmPitchDetector {
  sample_rate: usize,
  fft_size: usize,
  detector: Box<dyn PitchDetector<f32>>,
}

#[wasm_bindgen]
pub enum Kind {
  Y, M, A
}

#[wasm_bindgen]
impl WasmPitchDetector {
  pub fn new(which: Kind, sample_rate: usize, fft_size: usize) -> WasmPitchDetector {
    set_panic_hook();

    let fft_pad = fft_size / 2;

    WasmPitchDetector {
      sample_rate,
      fft_size,
      detector:
      match which {
        Kind::Y => Box::new(YINDetector::<f32>::new(fft_size, fft_pad)),
        Kind::M => Box::new(McLeodDetector::<f32>::new(fft_size, fft_pad)),
        Kind::A => Box::new(AutocorrelationDetector::<f32>::new(fft_size, fft_pad)),
      }
    }
  }

  pub fn detect_pitch(&mut self, audio_samples: Vec<f32>) -> f32 {
    if audio_samples.len() < self.fft_size {
      panic!("Insufficient samples passed to detect_pitch(). Expected an array containing {} elements but got {}", self.fft_size, audio_samples.len());
    }

    // Include only notes that exceed a power threshold which relates to the
    // amplitude of frequencies in the signal. Use the suggested default
    // value of 5.0 from the library.
    const POWER_THRESHOLD: f32 = 5.0;

    // The clarity measure describes how coherent the sound of a note is. For
    // example, the background sound in a crowded room would typically be would
    // have low clarity and a ringing tuning fork would have high clarity.
    // This threshold is used to accept detect notes that are clear enough
    // (valid values are in the range 0-1).
    const CLARITY_THRESHOLD: f32 = 0.6;

    let optional_pitch = self.detector.get_pitch(
      &audio_samples,
      self.sample_rate,
      POWER_THRESHOLD,
      CLARITY_THRESHOLD,
    );

    match optional_pitch {
      Some(pitch) => pitch.frequency,
      None => 0.0,
    }
  }
}
