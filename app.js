(function () {
  let LAST_SCORE;
  let micStream;
  let audioContext;

  let PitchDetection = {};
  shaped(
    PitchDetection,
    objMap({
      init: Boolean,
      method: any,
    })
  );

  // let PitchDetection = WasmPitch;

  function checkScore(score) {
    shaped(score, {
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
    });
  }

  function transposeScore(score) {
    checkScore(score);
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
    checkScore(res);
    return res;
  }

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

    createScorePartsUI();
  }

  MusicXML.init(onScoreLoad);

  window.loadScoreFile = function (e) {
    MusicXML.readFile(e.files[0]);
  };

  window.loadExample = function (s) {
    if (!s.value) {
      return;
    }
    MusicXML.loadScoreURL(s.value);
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

    // let noSinging = true;
    let noSinging = false;
    let testSinging = false;
    // let testSinging = true;

    // TODO do not init more than once if switched, and dispose
    await PitchDetection.init(audioContext, onNote, micStream);
    console.log('pitch detection initialized');

    if (!noSinging) {
      if (testSinging) {
        console.log('testing singing; all notes are synthetic!');
        function f() {
          onNote({
            note: part.range.notes[Math.floor(Math.random() * part.range.notes.length)],
            cents: Math.floor(Math.random() * 100 - 50),
          });
          setTimeout(f, Math.random() * 1000);
        }
        setTimeout(f, Math.random() * 1000);
      } else {
        PitchDetection.start();
      }
    } else {
      console.log('singing disabled');
    }

    let app = document.querySelector('#app');
    let canvas = document.querySelector('#flappy');
    let title = document.querySelector('#title-text').parentNode;
    // console.log('got all stuff');

    let bird_delay = gameStart({
      randomPipes: false,
      part,
      onStart() {
        app.style.display = 'none';
        title.style.display = 'none';
        // this also has the side effect that scroll bars are hidden
        canvas.style.display = 'block';
      },
      onEnd() {
        app.style.removeProperty('display');
        title.style.removeProperty('display');
        canvas.style.display = 'none';
        PitchDetection.stop();
      },
    });

    // console.log('game started');
    Play.parts(score, Object.keys(score.parts), bird_delay, btn.dataset.part);
    // console.log('parts playing');
  };

  window.previewOnePart = function (btn) {
    stopPreviewingParts();

    let score = LAST_SCORE;
    score = transposeScore(score);
    Play.parts(score, [btn.dataset.part], 0, null);
  };

  window.stopPreviewingParts = function () {
    Play.stop();
  };

  function createScorePartsUI() {
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
})();
