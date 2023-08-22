// import Game from './game.js';

(function () {
  let LAST_SCORE;
  let micStream;
  let audioContext;

  // let PitchDetection = Autocorrelation;
  let PitchDetection = ML5Pitch;

  async function onScoreLoad(score) {
    console.log('musicxml loaded', score);
    LAST_SCORE = score;

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
          top: String,
          bottom: String,
          octaves: Number,
          // semitones: Number,
          notes: [String],
        },
      }),
    });

    const firstTime = !audioContext;
    if (firstTime) {
      audioContext = new AudioContext();
      Play.init(audioContext);
      // request permission right before we start playing audio
      micStream = await requestMicPermission();
      await PitchDetection.init(audioContext, onNote, micStream);
      console.log('pitch detection model loaded');
    } else {
      stopPreviewingParts();
    }

    // preview level, rhythm-game style
    for (const p in score.parts) {
      previewPart(p, Object.keys(score.parts).length);
    }

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
    shaped(nc, nullOr({ note: isNote, cents: Number }));
    if (nc && nc.note) {
      console.log('pitch', nc);
      handleInput(nc.note);
    }
  }

  window.startGame = async function (btn) {
    stopPreviewingParts();

    let part = LAST_SCORE.parts[btn.dataset.part];
    console.log('generating level using', part);

    let testSinging = false;
    // let testSinging = true;

    if (testSinging) {
      setInterval(() => {
        onNote({
          note: part.range.notes[Math.floor(Math.random() * part.range.notes.length)],
          cents: 0,
        });
      }, 2000);
    } else {
      PitchDetection.start();
    }

    let app = document.querySelector('#app');
    let canvas = document.querySelector('#flappy');
    let title = document.querySelector('#title-text').parentNode;

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
    // play at a lower volume, so it's not jarring when compared to all parts playing initilaly
    Play.part(score, btn.dataset.part, bird_delay, Object.keys(score.parts).length);
  };

  let previewsPlaying = [];
  function previewPart(p, num_parts) {
    previewsPlaying.push(Play.part(LAST_SCORE, p, 0, num_parts));
  }

  window.previewOnePart = function (btn) {
    stopPreviewingParts();
    previewPart(btn.dataset.part, Object.keys(LAST_SCORE.parts).length);
  };

  window.stopPreviewingParts = function () {
    for (const stop of previewsPlaying) {
      stop();
    }
    previewsPlaying = [];
  };

  function createScorePartsUI() {
    let legend;
    let partsContainer = template(
      '#part-container',
      'legend',
      (e) => {
        legend = e;
        e.textContent = score.name;
      },
      '.info',
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
})();
