// import Game from './game.js';

let Play = (function () {
  const epsilon = 0.00001;

  function playNote(audioCtx, freq, time, dur) {
    oscillator = audioCtx.createOscillator();
    gain = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.connect(gain);
    oscillator.frequency.value = freq;
    gain.connect(audioCtx.destination);

    gain.gain.setValueAtTime(epsilon, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + time);
    gain.gain.linearRampToValueAtTime(epsilon, audioCtx.currentTime + time + dur);

    oscillator.start(audioCtx.currentTime + time);
    oscillator.stop(audioCtx.currentTime + time + dur);
  }

  // nd is an array of [note, duration] arrays.
  // tempo is bpm, where each beat is a quarter note
  function notes(nd, tempo) {
    let audioCtx = new AudioContext();
    let currentTime = 0;
    for (const [n, d] of nd) {
      let tpb = 1 / (tempo / 60) / 4; // qpm -> qps -> spq -> sp16th
      let dur = tpb * d;
      if (n) {
        let f = freqTable[440].filter((m) => m.note === n)[0].frequency;
        playNote(audioCtx, f, currentTime, dur);
      }
      currentTime += dur;
    }
  }

  function part(s, name) {
    function conv(n) {
      return [n.pitch ? n.pitch.note + n.pitch.octave : false, n.duration];
    }
    notes(s.parts[name].notes.flat().map(conv), s.parts[name].tempo);
  }
  return { notes, part };
})();

let lastScore;

MusicXML.init((score) => {
  console.log('musicxml loaded', score);
  lastScore = score;

  let template = document.querySelector('#part-container');
  let container = template.content.cloneNode(true);
  let legend = container.querySelector('legend');
  legend.textContent = score.name;

  for (const p in score.parts) {
    let template = document.querySelector('#part-player');
    let elt = template.content.cloneNode(true);
    elt.querySelector('.name').textContent = p;
    elt.querySelector('.info').textContent = `tempo: ${score.parts[p].tempo}, range: ${1}`;
    elt.querySelector('button').dataset.part = p;
    legend.after(elt);
  }
  document.querySelector('#part-loaded').replaceChildren(container);

  // temp
  // Play.part(score, 'Soprano');
  // Play.part(score, 'Alto');
  // Play.part(score, 'Tenor');
  // Play.part(score, 'Bass');
});

function loadScore(e) {
  MusicXML.readFile(e.files[0]);
}

async function startGame(btn) {
  console.log('generating level using', lastScore.parts[btn.dataset.part]);

  PitchDetection.init((nc) => {
    if (nc.note) {
      console.log(nc);
      handleInput(nc.note);
    }
  });

  //     if (this.state.mic.enabled) {
  //       PitchDetection.stop();
  //     } else {
  await PitchDetection.start();
  //     }
  gameStart({ randomPipes: true });
}
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
