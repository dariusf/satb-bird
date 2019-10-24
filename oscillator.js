import freqTable from "./notes.js";

// https://developer.microsoft.com/en-us/microsoft-edge/testdrive/demos/webaudiotuner

let sourceAudioNode;
let audioContext;

// TODO might be able to default to this
const baseFreq = 440;

let notesArray = freqTable[baseFreq];
let currentNoteIndex = 39; // Eb3

function changeBaseFreq(delta) {
  var newBaseFreq = baseFreq + delta;
  if (newBaseFreq >= 432 && newBaseFreq <= 446) {
    baseFreq = newBaseFreq;
    notesArray = freqTable[baseFreq.toString()];

    if (sourceAudioNode) {
      // Only change the frequency if we are playing a reference sound, since
      // sourceAudioNode will be an instance of OscillatorNode
      var newNoteFreq = notesArray[currentNoteIndex].frequency;
      sourceAudioNode.frequency.value = newNoteFreq;
    }
  }
}

function changeNote(delta) {
  var newNoteIndex = currentNoteIndex + delta;
  if (newNoteIndex >= 0 && newNoteIndex < notesArray.length) {
    currentNoteIndex = newNoteIndex;
    var newNoteFreq = notesArray[currentNoteIndex].frequency;
    sourceAudioNode.frequency.value = newNoteFreq;
    // In this case we haven't changed the base frequency, so we just need to update the note on screen
    // updateNote();
    return notesArray[currentNoteIndex].note;
  }
  return null;
}

function init(ac) {
  if (isAudioContextSupported()) {
    audioContext = new AudioContext();
  } else {
    throw "AudioContext is not supported in this browser.";
  }
}

function play() {
  // TODO
  // if (audioContext.state === 'suspended') {
  //   audioContext.resume();
  // }

  // TODO is this ok to not have?
  // if (isMicrophoneInUse) {
  //   toggleMicrophone();
  // }

  sourceAudioNode = audioContext.createOscillator();
  sourceAudioNode.frequency.value = notesArray[currentNoteIndex].frequency;
  sourceAudioNode.connect(audioContext.destination);
  sourceAudioNode.start();

  return notesArray[currentNoteIndex].note;
}

function stop() {
  sourceAudioNode.stop();
  sourceAudioNode = null;
// // 26-50 is D2 to D4
  // D2 to D4
  //   var low = 35;
  //   currentNoteIndex = Math.floor(Math.random() * (50-low)) + low;
}

function up() {
  return changeNote(1);
}

function down() {
  return changeNote(-1);
}

export default { init, play, stop, up, down };
