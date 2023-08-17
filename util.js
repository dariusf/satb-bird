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

// (function() {
//   var range = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

//   // TODO the default tone should be the same one as this

//   // var data = {
//   //   'C': 11,
//   //   'C#': 10,
//   //   'D': 9,
//   //   'D#': 8,
//   //   'E': 7,
//   //   'F': 6,
//   //   'F#': 5,
//   //   'G': 4,
//   //   'G#': 3,
//   //   'A': 2,
//   //   'A#': 1,
//   //   'B': 0,
//   // };

//   range = rotate(6, range).reverse();

//   var notePositions = {};
//   range.forEach((e, i) => {
//     notePositions[e] = i;
//   });

//   window.notePositions = notePositions;
// })();
