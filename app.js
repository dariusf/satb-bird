(function () {
  let LAST_SCORE;
  let micStream;
  let audioContext;

  let PitchDetection = WasmPitch;

  let scoreShape = {
    name: String,
    composer: String,
    parts: objMap({
      divisions: Number,
      tempo: Number,
      time: [Number],
      notes: [
        oneOf(
          { duration: Number, rest: Boolean },
          { duration: Number, pitch: { note: String, octave: Number }, lyrics: String }
        ),
        ,
      ],
      range: {
        top: isNote,
        bottom: isNote,
        octaves: Number,
        // semitones: Number,
        notes: [isNote],
      },
    }),
  };

  function checkScore(score) {
    shaped(score, scoreShape);
  }

  let transposeScore = define([scoreShape], scoreShape, (score) => {
    let { value } = document.querySelector('#transpose');
    let by = +value;
    let res = {
      ...score,
      parts: mapOverObject(score.parts, (_pn, p) => ({
        ...p,
        notes: p.notes.map((n) =>
          n.pitch
            ? {
                ...n,
                pitch: noteToExplicit(transposeNote(noteToImplicit(n.pitch), by)),
              }
            : n
        ),
        range: {
          ...p.range,
          top: transposeNote(p.range.top, by),
          bottom: transposeNote(p.range.bottom, by),
          notes: p.range.notes.map((n) => transposeNote(n, by)),
        },
      })),
    };
    return res;
  });

  async function onScoreLoad(score) {
    console.log('musicxml loaded', score);
    LAST_SCORE = score;

    checkScore(score);

    const firstTime = !audioContext;
    if (firstTime) {
      audioContext = new AudioContext();
      Play.init(audioContext);
      // request permission right before we start playing audio
      micStream = await requestMicPermission();
    } else {
      stopPreviewingParts();
    }

    // preview level, rhythm-game style
    Play.parts(score, Object.keys(score.parts), 0, null);

    createScorePartsUI(score);
  }

  MusicXML.init(onScoreLoad);

  window.loadScoreFile = async function (e) {
    // TODO race, it's possible to start the game while the score is rendering but after it is loaded
    let xml = await MusicXML.readFile(e.files[0]);
    await OSMD.load(xml);
  };

  window.loadExample = async function (s) {
    if (!s.value) {
      return;
    }
    let xml = await MusicXML.loadScoreURL(s.value);
    await OSMD.load(xml);
  };

  function onNote(nc) {
    shaped(nc, nullOr(noteCents));
    if (nc) {
      console.log('pitch detected', nc);
      handleInput(nc);
    }
  }

  window.startGame = async function (btn) {
    stopPreviewingParts();

    let score = LAST_SCORE;
    score = transposeScore(score);

    let part = score.parts[btn.dataset.part];
    console.log('generating level using', part);

    let pitchConfig = pitchDetectionConfig();

    if (pitchConfig.method === 'auto') {
      // do nothing, and do not start pitch detection
      console.log('auto, no pitch input');
    } else if (pitchConfig.method === 'random') {
      console.log('random input; synthetic pitch input!');
      function f() {
        onNote({
          note: part.range.notes[Math.floor(Math.random() * part.range.notes.length)],
          cents: Math.floor(Math.random() * 100 - 50),
        });
        setTimeout(f, Math.random() * 1000);
      }
      setTimeout(f, Math.random() * 1000);
    } else {
      // this is just the lifecycle, it's up to each impl to optimize repeated initialization
      await PitchDetection.init(audioContext, onNote, micStream, pitchConfig);
      console.log('pitch detection initialized');
      PitchDetection.start();
    }

    let app = document.querySelector('#app');
    let canvas = document.querySelector('#flappy');
    let title = document.querySelector('#title-text')?.parentNode;
    let stopBtn = document.querySelector('button#stop-game');

    let bird_delay = gameStart({
      randomPipes: false,
      part,
      onStart() {
        app.style.display = 'none';
        if (title) {
          title.style.display = 'none';
        }
        // this also has the side effect that scroll bars are hidden
        canvas.style.display = 'block';
        stopBtn.style.removeProperty('display');
      },
      onEnd() {
        stopBtn.style.display = 'none';
        Play.stop(); // in case the game didn't end normally
        app.style.removeProperty('display');
        if (title) {
          title.style.removeProperty('display');
        }
        canvas.style.display = 'none';
        PitchDetection.stop();
        PitchDetection.destroy();
        OSMD.hide();
        window.firstPipe = false;
      },
      ai: pitchConfig.method === 'auto',
      movement: movementKind(),
      onPipeEncountered: () => {
        if (!window.firstPipe) {
          // skip the first note
          window.firstPipe = true;
          return;
        }
        OSMD.next();
      },
      noteBeingSung: noteBeingSung(),
    });

    Play.parts(score, Object.keys(score.parts), bird_delay, btn.dataset.part);

    OSMD.show();
    OSMD.startPart(btn.dataset.part); // scroll only after visible
  };

  window.previewOnePart = function (btn) {
    stopPreviewingParts();

    let score = LAST_SCORE;
    score = transposeScore(score);
    Play.parts(score, [btn.dataset.part], 0, null);
  };

  window.transposeChange = function () {
    stopPreviewingParts();
    let score = LAST_SCORE;
    score = transposeScore(score);
    createScorePartsUI(score);
    Play.parts(score, Object.keys(score.parts), 0, null);
  };

  window.stopPreviewingParts = function () {
    Play.stop();
  };

  function createScorePartsUI(score) {
    let legend;
    let partsContainer = template(
      '#part-container',
      'legend.info',
      (e) => {
        legend = e;
        e.textContent = score.name;
      },
      'div.info',
      (e) => {
        let tempoRef = Object.keys(score.parts)[0];
        e.innerHTML = `<div>${score.composer}</div><div>♩=${score.parts[tempoRef].tempo}</div>`;
      }
    );

    for (const p in score.parts) {
      let elt = template(
        '#part-player',
        '.name',
        p,
        '.info1',
        `${score.parts[p].range.bottom}-${score.parts[p].range.top}`,
        '.info2',
        `${score.parts[p].range.octaves} octaves`,
        'button',
        (b) => (b.dataset.part = p)
      );
      legend.parentNode.appendChild(elt);
    }
    document.querySelector('#parts-view').replaceChildren(partsContainer);
  }

  window.toggleProMode = function (on) {
    if (on) {
      document.querySelectorAll('.pro-only').forEach((e) => e.style.removeProperty('display'));
    } else {
      document.querySelectorAll('.pro-only').forEach((e) => (e.style.display = 'none'));
    }
  };

  function pitchDetectionConfig() {
    let m = document.querySelector('select#pitch-detection-method').value;
    let w = document.querySelector('select#window-size').value;
    return { method: m, windowSize: +w };
  }

  window.chosenSynth = function () {
    return document.querySelector('select#synth').value;
  };

  function movementKind() {
    return document.querySelector('select#movement-kind').value;
  }

  function noteBeingSung() {
    return document.querySelector('input#note-being-sung').checked;
  }
})();
