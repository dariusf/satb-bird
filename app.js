import htm from 'https://unpkg.com/htm@2.2.1/dist/htm.module.js';
import produce from 'https://unpkg.com/immer@0.8.0?module';
import Game from './game.js';
import PlayTone from './oscillator.js';
import Score from './score.js';
import PitchDetection from './autocorrelation.js';
import { shaped, or } from './shaped.js';

const html = htm.bind(React.createElement);

function checkScore() {
  shaped(score, {
    name: String,
    composer: String,
    parts: {}
  });
  Object.values(score.parts).forEach(p =>
    shaped(p, {
      divisions: Number,
      tempo: Number,
      time: [Number],
      notes: [
        [
          {
            duration: Number,
            rest: or(Boolean, undefined),
            pitch: or({ note: String, octave: Number }, undefined)
          }
        ]
      ]
    })
  );
}

const useStyles = MaterialUI.makeStyles(theme => ({
  button: {
    margin: theme.spacing(1)
  },
  filePicker: {
    display: 'none'
  },

  textField: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1)
  }
}));

function FilePicker(props) {
  const classes = useStyles();
  return html`
    <span>
      <input
        accept=".musicxml,.xml"
        className=${classes.filePicker}
        id="contained-button-file"
        onChange=${e => props.onChange(e.target.files[0])}
        type="file"
      />
      <label htmlFor="contained-button-file">
        <${Button} variant="contained" component="span" className=${classes.button} text="choose" />
      </label>
    </span>
  `;
}

function Field(props) {
  const classes = useStyles();
  return html`
    <${MaterialUI.TextField}
      label=${props.label}
      onChange=${props.onChange}
      placeholder=${props.label}
      className=${classes.textField}
      margin="normal"
      variant="outlined"
    />
  `;
}

function Button(props) {
  // return html`<button ...${props}>${props.text}</button>`;
  const classes = useStyles();
  return html`<${MaterialUI.Button} variant="contained" ...${props} className=${classes.button}>${props.text}</${MaterialUI.Button}>`;
}

function Switch(props) {
  return html`
    <${MaterialUI.FormControlLabel}
      control=${html`
        <${MaterialUI.Switch} checked=${props.checked} onChange=${props.onChange} />
      `}
      label=${props.label}
    />
  `;
}

class App extends React.Component {
  state = {
    level: 'random', // random, some, musicxml, midi
    game: {
      type: 'flappy', // tuning, 0player
      started: false
    },
    score: {
      data: null, // checkScore
      url: null, // the url in the ui
      view: 0 // file, url in that order
    },
    mic: {
      enabled: false,
      data: null // whatever PitchDetection returns
    },
    tone: {
      enabled: false,
      note: null // whatever PlayTone returns
    },
    range: {
      lower: 'C3',
      upper: 'D4'
    },
    error: null, // for error messages which render the entire thing unusable
    firstUserAction: true // used to lazily init modules as we need a user action to create an AudioContext in Chrome
  };

  constructor(props) {
    super(props);
    Score.init(score => {
      checkScore(score);
      this.setState(produce(s => (s.score.data = score)));
    });
  }

  onNote(nc) {
    shaped(nc, { note: or(String, null), cents: or(Number, null) });
    this.setState(produce(s => (s.mic.data = nc)));
    Game.handleInput(nc.note);
  }

  ensureInitialized() {
    if (!this.state.firstUserAction) {
      return;
    }
    try {
      PlayTone.init();
      PitchDetection.init(nc => {
        if (nc.note) {
          this.onNote(nc);
        }
      });
    } catch (e) {
      this.setState(produce(s => (s.error = e)));
    }
    this.setState(produce(s => (s.firstUserAction = false)));
  }

  componentDidMount() {}

  componentWillUnmount() {}

  urlInput(e) {
    let url = e.target.value;
    this.setState(produce(s => (s.score.url = url)));
  }

  urlLoad(e) {
    Score.loadScoreURL(this.state.score.url);
  }

  loadScore(file) {
    Score.readFile(file);
  }

  toggleMic() {
    this.ensureInitialized();
    if (this.state.mic.enabled) {
      PitchDetection.stop();
    } else {
      PitchDetection.start();
    }
    this.setState(produce(s => (s.mic.enabled = !s.mic.enabled)));
  }

  toggleTone() {
    this.ensureInitialized();
    if (this.state.tone.enabled) {
      PlayTone.stop();
    } else {
      let note = PlayTone.play();
      if (note) {
        this.setState(produce(s => (s.tone.note = note)));
      }
    }
    this.setState(produce(s => (s.tone.enabled = !s.tone.enabled)));
  }

  startGame() {
    this.ensureInitialized();
    Game.start({ randomPipes: true });
  }

  toneUp() {
    let note = PlayTone.up();
    if (note) {
      this.setState(produce(s => (s.tone.note = note)));
    }
  }

  toneDown() {
    let note = PlayTone.down();
    if (note) {
      this.setState(produce(s => (s.tone.note = note)));
    }
  }

  render() {
    if (this.state.error) {
      return html`
        <p>${this.state.error}</p>
      `;
    }

    return html`
      <div>
        <fieldset style=${{ display: 'inline' }}>
          <legend>Debug</legend>
          <${Button} onClick=${() => console.log(this.state)} text="state" />
          <${Button} onClick=${() => this.onNote({ note: 'D#2', cents: 0 })} text="low note" />
          <${Button} onClick=${() => this.onNote({ note: 'C4', cents: 0 })} text="high note" />
        </fieldset>

        <fieldset style=${{ display: 'inline' }}>
          <legend>Input</legend>
          <${Button} onClick=${() => console.log('calibrate')} text="calibrate" />

          <!-- <label>
            <input type="radio" value="option1" checked=${true} />
            Microsoft
          </label>
          <label>
            <input type="radio" value="option2" checked=${false} />
            ml5js
          </label> -->
        </fieldset>

        <fieldset style=${{ display: 'inline' }}>
          <legend>Tone</legend>
          <${Switch} label="Tone" onChange=${this.toggleTone.bind(this)} checked=${this.state.tone.enabled} />
          ${this.state.tone.enabled &&
            html`
              <div>
                <${Button} onClick=${this.toneDown.bind(this)} text="lower" />
                <${Button} onClick=${this.toneUp.bind(this)} text="higher" />
                <span>${this.state.tone.note}</span>
              </div>
            `}
        </fieldset>

        <fieldset style=${{ display: 'inline' }}>
          <legend>Pitch</legend>
          <${Switch} label="Mic" onChange=${this.toggleMic.bind(this)} checked=${this.state.mic.enabled} />
          ${this.state.mic.enabled &&
            html`
              <div>
                <div>${this.state.mic.data.note}</div>
                <div>${this.state.mic.data.cents}</div>
              </div>
            `}
        </fieldset>

        <fieldset style=${{ display: 'inline' }}>
          <legend>Game</legend>
          <${Button} onClick=${this.startGame.bind(this)} text="start" />
        </fieldset>

        <select
          value=${this.state.level}
          onChange=${event => {
            let a = event.target.value;
            this.setState(produce(s => (s.level = a)));
          }}
        >
          <option value=${'random'} key=${'random'}>Random</option>
          <option value=${'some'} key=${'some'}>Some score</option>
          <option value=${'musicxml'} key=${'musicxml'}>MusicXML</option>
          <option value=${'midi'}>MIDI</option>
        </select>

        <fieldset style=${{ display: 'inline' }}>
          <legend>Score</legend>

          <${MaterialUI.Paper}>
            <${MaterialUI.Tabs}
            indicatorColor="primary"
            onChange=${(_e, n) => this.setState(produce(s => (s.score.view = n)))} value=${this.state.score.view}>
              <${MaterialUI.Tab} label="File" />
              <${MaterialUI.Tab} label="URL" />
            </${MaterialUI.Tabs}>
          </${MaterialUI.Paper}>

          ${this.state.score.view === 0 &&
            html`
              <${FilePicker} onChange=${this.loadScore.bind(this)} />
            `}
          <!--
          https://raw.githubusercontent.com/opensheetmusicdisplay/opensheetmusicdisplay/develop/test/data/Land_der_Berge.musicxml
          -->
          ${this.state.score.view === 1 &&
            html`
              <div>
                <${Field} label="url" onChange=${this.urlInput.bind(this)} />
                <${Button} onClick=${this.urlLoad.bind(this)} text="load" />
              </div>
            `}
        </fieldset>
      </div>
    `;
  }
}

ReactDOM.render(React.createElement(App), document.getElementById('app'));
