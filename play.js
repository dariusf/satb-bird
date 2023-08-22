let Play = (function () {
  let audioCtx;

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
    gain.connect(audioCtx.destination);

    gain.gain.setValueAtTime(epsilon, audioCtx.currentTime);
    // there might be other parts playing simultaneously, so we can't play at full volume
    gain.gain.linearRampToValueAtTime(1 / num_parts, audioCtx.currentTime + time);
    gain.gain.linearRampToValueAtTime(epsilon, audioCtx.currentTime + time + dur);

    oscillator.start(audioCtx.currentTime + time);
    oscillator.stop(audioCtx.currentTime + time + dur);

    return oscillator;
  }

  // nd is an array of [note, duration in divisions] arrays.
  // tempo is bpm, where each beat is a quarter note
  // num_parts is the number of voices playing concurrently,
  // which affects the maximum gain we can use.
  function notes(nd, tempo, divisions, bird_delay, num_parts) {
    let currentTime = 0;
    let sources = [];
    for (const [n, d] of nd) {
      let dur = durationToTime(tempo, divisions, d);
      if (n) {
        sources.push(playNote(NOTE_TO_FREQ[n], currentTime + bird_delay, dur, num_parts));
      }
      currentTime += dur;
    }
    return () => sources.forEach((s) => s.stop(0));
  }

  function part(s, name, bird_delay, num_parts) {
    function conv(n) {
      return [n.pitch ? n.pitch.note + n.pitch.octave : false, n.duration];
    }
    return notes(s.parts[name].notes.map(conv), s.parts[name].tempo, s.parts[name].divisions, bird_delay, num_parts);
  }

  function init(audioContext) {
    audioCtx = audioContext;
  }

  return { init, notes, part };
})();
