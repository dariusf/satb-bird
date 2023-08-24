let Play = (function () {
  let audioCtx;

  // list of functions for stopping current playbac
  let toStop = [];

  // time is an offset from now
  // dur is an offset from time
  function playNote(freq, time, dur, num_parts) {
    oscillator = audioCtx.createOscillator();
    gain = audioCtx.createGain();
    // oscillator.type = 'sine';
    // oscillator.type = 'sawtooth';
    // oscillator.type = 'square';
    oscillator.type = 'triangle';
    oscillator.connect(gain);
    oscillator.frequency.value = freq;

    gain.gain.setValueAtTime(epsilon, audioCtx.currentTime);
    // there might be other parts playing simultaneously, so we can't play at full volume
    gain.gain.linearRampToValueAtTime(1 / num_parts, audioCtx.currentTime + time);
    gain.gain.linearRampToValueAtTime(epsilon, audioCtx.currentTime + time + dur);

    oscillator.start(audioCtx.currentTime + time);
    oscillator.stop(audioCtx.currentTime + time + dur);

    return { src: oscillator, end: gain };
  }

  // nd is an array of [note, duration in divisions] arrays.
  // tempo is bpm, where each beat is a quarter note
  // num_parts is the number of voices playing concurrently,
  // which affects the maximum gain we can use.
  function notes(nd, tempo, divisions, bird_delay, num_parts) {
    let currentTime = 0;
    let chains = [];
    for (const [n, d] of nd) {
      let dur = durationToTime(tempo, divisions, d);
      if (n) {
        chains.push(playNote(NOTE_TO_FREQ[n], currentTime + bird_delay, dur, num_parts));
      }
      currentTime += dur;
    }
    return chains;
  }

  function parts(score, parts, bird_delay) {
    function conv(n) {
      return [n.pitch ? n.pitch.note + n.pitch.octave : false, n.duration];
    }
    // even if playing only one part, play it at a lower volume, so it's not jarring when compared to all parts playing initially
    let frac = Object.keys(score.parts).length;
    let chains = parts.flatMap((p) =>
      notes(score.parts[p].notes.map(conv), score.parts[p].tempo, score.parts[p].divisions, bird_delay, frac)
    );
    for (const c of chains) {
      toStop.push(() => c.src.stop(0));
      c.end.connect(audioCtx.destination);
    }
  }

  function stop() {
    toStop.forEach((s) => s());
  }

  function init(audioContext) {
    audioCtx = audioContext;
  }

  return { init, notes, parts, stop };
})();
