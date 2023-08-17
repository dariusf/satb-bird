// function isAudioContextSupported() {
//   window.AudioContext = window.AudioContext || window.webkitAudioContext;
//   return !!window.AudioContext;
// }

// function isGetUserMediaSupported() {
//   navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
//   return (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || navigator.getUserMedia;
// }

async function requestMicPermission() {
  // TODO required?

  //   if (audioContext.state === "suspended") {
  //     audioContext.resume();
  //   }

  // let getUserMedia =
  //   navigator.mediaDevices && navigator.mediaDevices.getUserMedia

  //     ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  //     : function (constraints) {
  //         return new Promise(function (resolve, reject) {
  //           navigator.getUserMedia(constraints, resolve, reject);
  //         });
  //       };

  return navigator.mediaDevices.getUserMedia({ audio: true });

  // throttleOutput('C4', 0);
}

// for consuming XPathResults fully
function iterate(i, f) {
  elt = i.iterateNext();
  while (elt) {
    f(elt);
    elt = i.iterateNext();
  }
}

function toList(i) {
  let a = [];
  iterate(i, (e) => a.push(e));
  return a;
}

function rotate(n, a) {
  return a.slice(a.length - n).concat(a.slice(0, a.length - n));
}

const epsilon = 0.00001;

/*
  Time in MusicXML:

  - tempo is given in quarter notes per minute
  - each measure has divisions (per quarter note), allowing a single number to represent duration while retaining a rational representation
  - duration is given in number of divisions
  - ties need to be taken into account
  - metronome element is visual but gives the familiar crochet = number notation
  - dots are purely visual, the duration is already changed
*/
function durationToTime(tempo, divisions, duration) {
  let tpb = 1 / (tempo / 60) / divisions;
  let dur = tpb * duration;
  // bpm -> b/s -> s/b -> s/d -> s
  return dur;
}
