// import Game from './game.js';

let Play = (function () {
  const epsilon = 0.00001;

  // time is an offset from now
  // dur is an offset from time
  function playNote(audioCtx, freq, time, dur) {
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
    gain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + time);
    gain.gain.linearRampToValueAtTime(epsilon, audioCtx.currentTime + time + dur);

    oscillator.start(audioCtx.currentTime + time);
    oscillator.stop(audioCtx.currentTime + time + dur);

    return oscillator;
  }

  // nd is an array of [note, duration] arrays.
  // tempo is bpm, where each beat is a quarter note
  function notes(nd, tempo, bird_delay) {
    let audioCtx = new AudioContext();
    let currentTime = 0;
    let sources = [];
    for (const [n, d] of nd) {
      let tpb = 1 / (tempo / 60) / 4; // quar/min -> quar/sec -> sec/quar -> sec/16th
      let dur = tpb * d;
      if (n) {
        let f = freqTable[440].filter((m) => m.note === n)[0].frequency;
        sources.push(playNote(audioCtx, f, currentTime + bird_delay, dur));
      }
      currentTime += dur;
    }
    return () => sources.forEach((s) => s.stop(0));
  }

  function part(s, name, bird_delay) {
    function conv(n) {
      return [n.pitch ? n.pitch.note + n.pitch.octave : false, n.duration];
    }
    return notes(s.parts[name].notes.flat().map(conv), s.parts[name].tempo, bird_delay);
  }
  return { notes, part };
})();

let lastScore;
let micStream;

MusicXML.init(async (score) => {
  console.log('musicxml loaded', score);
  lastScore = score;

  shaped(score, {
    name: String,
    composer: String,
    parts: objMap({
      divisions: Number,
      tempo: Number,
      time: [Number],
      notes: [
        [
          oneOf(
            { duration: Number, rest: Boolean },
            { duration: Number, pitch: { note: String, octave: Number }, lyrics: String }
          ),
        ],
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

  let template = document.querySelector('#part-container');
  let container = template.content.cloneNode(true);
  let legend = container.querySelector('legend');
  legend.textContent = score.name;
  let songInfo = container.querySelector('.info');
  let tempoRef = Object.keys(score.parts)[0];
  songInfo.innerHTML = `<div>${score.composer}</div><div>♩=${score.parts[tempoRef].tempo}</div>`;

  for (const p in score.parts) {
    let template = document.querySelector('#part-player');
    let elt = template.content.cloneNode(true);
    elt.querySelector('.name').textContent = p;
    elt.querySelector(
      '.info'
    ).textContent = `${score.parts[p].range.bottom}-${score.parts[p].range.top} (${score.parts[p].range.octaves} octaves)`;
    elt.querySelectorAll('button').forEach((b) => (b.dataset.part = p));
    legend.parentNode.appendChild(elt);
  }
  document.querySelector('#part-loaded').replaceChildren(container);

  // request permission at this point, right before we start playing audio
  micStream = await requestMicPermission();

  // preview level, rhythm-game style
  for (const p in score.parts) {
    previewPart(p);
  }
});

function loadScoreFile(e) {
  MusicXML.readFile(e.files[0]);
}

function loadExample(s) {
  if (!s.value) {
    return;
  }
  MusicXML.loadScoreURL(s.value);
}

function isNote(n) {
  return !!freqTable[440].filter((m) => m.note === n);
}

async function startGame(btn) {
  stopPreviewingParts();

  let part = lastScore.parts[btn.dataset.part];
  console.log('generating level using', part);

  Autocorrelation.init((nc) => {
    // this is expensive
    shaped(nc, { note: nullOr(isNote), cents: nullOr(Number) });
    if (nc.note) {
      console.log('pitch', nc);
      handleInput(nc.note);
    }
  });

  Autocorrelation.start(micStream);

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
    },
  });
  Play.part(score, btn.dataset.part, bird_delay);
}

let previewsPlaying = [];
function previewPart(p) {
  previewsPlaying.push(Play.part(score, p, 0));
}

function previewOnePart(btn) {
  stopPreviewingParts();
  previewPart(btn.dataset.part);
}

function stopPreviewingParts() {
  for (const stop of previewsPlaying) {
    stop();
  }
  previewsPlaying = [];
}

//       PitchDetection.stop();

// window.startGame = startGame;

// import Game from './game.js';
// import PlayTone from './oscillator.js';
// import Score from './score.js';
// import PitchDetection from './autocorrelation.js';
// import Midi from './midi.js';

// // const useStyles = MaterialUI.makeStyles((theme) => ({
// //   button: {
// //     margin: theme.spacing(1),
// //   },
// //   filePicker: {
// //     display: 'none',
// //   },

// //   textField: {
// //     marginLeft: theme.spacing(1),
// //     marginRight: theme.spacing(1),
// //   },
// // }));

// function FilePicker(props) {
//   // const classes = useStyles();
//   return html`
//     <span>
//       <input
//         accept=".musicxml,.xml,.mid,.midi"
//         className=${classes.filePicker}
//         id="contained-button-file"
//         onChange=${(e) => props.onChange(e.target.files[0])}
//         type="file"
//       />
//       <label htmlFor="contained-button-file">
//         <${Button} variant="contained" component="span" className=${classes.button} text="choose" />
//       </label>
//     </span>
//   `;
// }

// function Field(props) {
//   // const classes = useStyles();
//   return html`
//     <${MaterialUI.TextField}
//       label=${props.label}
//       onChange=${props.onChange}
//       placeholder=${props.label}
//       className=${classes.textField}
//       margin="normal"
//       variant="outlined"
//     />
//   `;
// }

// function Button(props) {
//   // return html`<button ...${props}>${props.text}</button>`;
//   // const classes = useStyles();
//   return html`<${MaterialUI.Button} variant="contained" ...${props} className=${classes.button}>${props.text}</${MaterialUI.Button}>`;
// }

// function Switch(props) {
//   return html`
//     <${MaterialUI.FormControlLabel}
//       control=${html` <${MaterialUI.Switch} checked=${props.checked} onChange=${props.onChange} /> `}
//       label=${props.label}
//     />
//   `;
// }

// class App extends React.Component {
//   state = {
//     level: 'random', // random, some, musicxml, midi
//     game: {
//       type: 'flappy', // tuning, 0player
//       started: false,
//     },
//     score: {
//       data: null, // checkScore
//       url: null, // the url in the ui
//       view: 0, // file, url in that order
//       // TODO consider moving this ui state somewhere else
//     },
//     mic: {
//       enabled: false,
//       data: null, // whatever PitchDetection returns
//     },
//     tone: {
//       enabled: false,
//       note: null, // whatever PlayTone returns
//     },
//     range: {
//       lower: 'C3',
//       upper: 'D4',
//     },
//     error: null, // for error messages which render the entire thing unusable
//     firstUserAction: true, // used to lazily init modules as we need a user action to create an AudioContext in Chrome
//   };

//   constructor(props) {
//     super(props);
//     Score.init((score) => {
//       this.setState(produce((s) => (s.score.data = score)));
//     });
//   }

//   onNote(nc) {
//     this.setState(produce((s) => (s.mic.data = nc)));
//     Game.handleInput(nc.note);
//   }

//   ensureInitialized() {
//     if (!this.state.firstUserAction) {
//       return;
//     }
//     try {
//       PlayTone.init();
//       PitchDetection.init((nc) => {
//         if (nc.note) {
//           this.onNote(nc);
//         }
//       });
//     } catch (e) {
//       this.setState(produce((s) => (s.error = e)));
//     }
//     this.setState(produce((s) => (s.firstUserAction = false)));
//   }

//   componentDidMount() {}

//   componentWillUnmount() {}

//   urlInput(e) {
//     let url = e.target.value;
//     this.setState(produce((s) => (s.score.url = url)));
//   }

//   urlLoad(e) {
//     Score.loadScoreURL(this.state.score.url);
//   }

//   loadScore(file) {
//     if (!file) return;
//     if (file.name.endsWith('.mid') || file.name.endsWith('.midi')) {
//       Midi.readFile(file);
//     } else {
//       Score.readFile(file);
//     }
//   }

//   playScore() {
//     // TODO check if a score is loaded
//     // TODO what happens for musicxml?
//     Midi.play();
//   }

//   stopScore(file) {
//     // TODO check if a score is loaded
//     // TODO what happens for musicxml?
//     Midi.stop();
//   }

//   toggleMic() {
//     this.ensureInitialized();
//     if (this.state.mic.enabled) {
//       PitchDetection.stop();
//     } else {
//       PitchDetection.start();
//     }
//     this.setState(produce((s) => (s.mic.enabled = !s.mic.enabled)));
//   }

//   toggleTone() {
//     this.ensureInitialized();
//     if (this.state.tone.enabled) {
//       PlayTone.stop();
//     } else {
//       let note = PlayTone.play();
//       if (note) {
//         this.setState(produce((s) => (s.tone.note = note)));
//       }
//     }
//     this.setState(produce((s) => (s.tone.enabled = !s.tone.enabled)));
//   }

//   startGame() {
//     this.ensureInitialized();
//   }

//   toneUp() {
//     let note = PlayTone.up();
//     if (note) {
//       this.setState(produce((s) => (s.tone.note = note)));
//     }
//   }

//   toneDown() {
//     let note = PlayTone.down();
//     if (note) {
//       this.setState(produce((s) => (s.tone.note = note)));
//     }
//   }

//   render() {
//     if (this.state.error) {
//       return html` <p>${this.state.error}</p> `;
//     }

//     return html`
//       <div>
//         <fieldset style=${{ display: 'inline' }}>
//           <legend>Debug</legend>
//           <${Button} onClick=${() => console.log(this.state)} text="state" />
//           <${Button} onClick=${() => this.onNote({ note: 'D#2', cents: 0 })} text="low note" />
//           <${Button} onClick=${() => this.onNote({ note: 'C4', cents: 0 })} text="high note" />
//         </fieldset>

//         <fieldset style=${{ display: 'inline' }}>
//           <legend>Input</legend>
//           <${Button} onClick=${() => console.log('calibrate')} text="calibrate" />

//           <!-- <label>
//             <input type="radio" value="option1" checked=${true} />
//             Microsoft
//           </label>
//           <label>
//             <input type="radio" value="option2" checked=${false} />
//             ml5js
//           </label> -->
//         </fieldset>

//         <fieldset style=${{ display: 'inline' }}>
//           <legend>Tone</legend>
//           <${Switch} label="Tone" onChange=${this.toggleTone.bind(this)} checked=${this.state.tone.enabled} />
//           ${
//             this.state.tone.enabled &&
//             html`
//               <div>
//                 <${Button} onClick=${this.toneDown.bind(this)} text="lower" />
//                 <${Button} onClick=${this.toneUp.bind(this)} text="higher" />
//                 <span>${this.state.tone.note}</span>
//               </div>
//             `
//           }
//         </fieldset>

//         <fieldset style=${{ display: 'inline' }}>
//           <legend>Pitch</legend>
//           <${Switch} label="Mic" onChange=${this.toggleMic.bind(this)} checked=${this.state.mic.enabled} />
//           ${
//             this.state.mic.enabled &&
//             html`
//               <div>
//                 <div>${this.state.mic.data.note}</div>
//                 <div>${this.state.mic.data.cents}</div>
//               </div>
//             `
//           }
//         </fieldset>

//         <fieldset style=${{ display: 'inline' }}>
//           <legend>Game</legend>
//           <${Button} onClick=${this.startGame.bind(this)} text="start" />
//         </fieldset>

//         <select
//           value=${this.state.level}
//           onChange=${(event) => {
//             let a = event.target.value;
//             this.setState(produce((s) => (s.level = a)));
//           }}
//         >
//           <option value=${'random'} key=${'random'}>Random</option>
//           <option value=${'some'} key=${'some'}>Some score</option>
//           <option value=${'musicxml'} key=${'musicxml'}>MusicXML</option>
//           <option value=${'midi'}>MIDI</option>
//         </select>

//         <fieldset style=${{ display: 'inline' }}>
//           <legend>Score</legend>

//           <${MaterialUI.Paper}>
//             <${MaterialUI.Tabs}
//             indicatorColor="primary"
//             onChange=${(_e, n) => this.setState(produce((s) => (s.score.view = n)))} value=${this.state.score.view}>
//               <${MaterialUI.Tab} label="File" />
//               <${MaterialUI.Tab} label="URL" />
//             </${MaterialUI.Tabs}>
//           </${MaterialUI.Paper}>

//           ${this.state.score.view === 0 && html` <${FilePicker} onChange=${this.loadScore.bind(this)} /> `}
//           <!--
//           https://raw.githubusercontent.com/opensheetmusicdisplay/opensheetmusicdisplay/develop/test/data/Land_der_Berge.musicxml
//           -->
//           ${
//             this.state.score.view === 1 &&
//             html`
//               <div>
//                 <${Field} label="url" onChange=${this.urlInput.bind(this)} />
//                 <${Button} onClick=${this.urlLoad.bind(this)} text="load" />
//               </div>
//             `
//           }

//           <${Button} onClick=${this.playScore.bind(this)} text="play" />
//           <${Button} onClick=${this.stopScore.bind(this)} text="stop" />
//         </fieldset>
//       </div>
//     `;
//   }
// }

// ReactDOM.render(React.createElement(App), document.getElementById('app'));
