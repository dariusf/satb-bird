/* tslint:disable */
/* eslint-disable */
/**
*/
export enum Kind {
  Y = 0,
  M = 1,
  A = 2,
}
/**
*/
export class WasmPitchDetector {
  free(): void;
/**
* @param {number} which
* @param {number} sample_rate
* @param {number} fft_size
* @returns {WasmPitchDetector}
*/
  static new(which: number, sample_rate: number, fft_size: number): WasmPitchDetector;
/**
* @param {Float32Array} audio_samples
* @returns {number}
*/
  detect_pitch(audio_samples: Float32Array): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmpitchdetector_free: (a: number) => void;
  readonly wasmpitchdetector_new: (a: number, b: number, c: number) => number;
  readonly wasmpitchdetector_detect_pitch: (a: number, b: number, c: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
