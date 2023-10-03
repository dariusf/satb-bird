let midi;
let synths = [];

// https://tonejs.github.io/Midi/

function readFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    midi = new Midi(e.target.result);
    console.log(JSON.stringify(midi, undefined, 2));
  };
  reader.readAsArrayBuffer(file);
}

function play() {
  const now = Tone.now() + 0.5;
  midi.tracks.forEach(track => {
    const synth = new Tone.PolySynth(10, Tone.Synth, {
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.3,
        release: 1
      }
    }).toMaster();
    synths.push(synth);
    track.notes.forEach(note => {
      synth.triggerAttackRelease(note.name, note.duration, note.time + now, note.velocity);
    });
  });
}

function stop() {
  while (synths.length) {
    const synth = synths.shift();
    synth.dispose();
  }
}

export default { readFile, play, stop };
