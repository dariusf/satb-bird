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

function template(id, ...args) {
  let template = document.querySelector(id);
  let content = template.content.cloneNode(true);
  for (var i = 0; i < args.length; i += 2) {
    let elt = content.querySelectorAll(args[i]);
    let act = args[i + 1];
    if (act instanceof Function) {
      elt.forEach(act);
    } else if (typeof act === 'string') {
      elt.forEach((e) => (e.textContent = args[i + 1]));
    } else {
      console.warn('unknown action', act);
    }
  }
  return content;
}

let GameLoop = (function () {
  let prev;

  // variable tick rate, as we don't need determinism, just framerate-independence.
  // someday, https://gafferongames.com/post/fix_your_timestep/
  function simple(f) {
    function step(now) {
      if (prev !== undefined) {
        // there is no dt on the first frame.
        // technically we lose one frame.
        // compensate by doubling dt on the second?
        const dt = now - prev;
        f(dt / 1000);
      }
      prev = now;

      window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  function fixed(fps, update, render) {
    const dt = 1 / fps; // fixed frame rate

    let elapsed = 0.0;
    let accumulator = 0.0; // remainder time
    // dt - accumulator is how much time is required until another whole physics step can be taken

    let currentTime;

    requestAnimationFrame((time) => {
      currentTime = time;
      requestAnimationFrame(loop);
    });

    function loop(now) {
      requestAnimationFrame(loop);

      // how much time was actually taken since last frame,
      // i.e. variable dt
      let frameTime = now - currentTime;

      // cap. i guess this is ok because if we get this much stutter, we won't notice a bit of lost time. the simulation will be slower wrt the wall clock but not be incorrect

      // if (frameTime > 0.25) {
      //   frameTime = 0.25;
      // }
      frameTime = Math.min(frameTime, 0.25 * 1000);
      currentTime = now;

      accumulator += frameTime;

      while (accumulator >= dt) {
        // previousState = currentState;
        update(dt / 1000, elapsed);
        elapsed += dt;
        accumulator -= dt;
      }

      const alpha = accumulator / dt;

      // State state = currentState * alpha +
      // previousState * (1.0 - alpha);

      // update should keep track of previous state and make it accessible to render
      render(alpha);
    }
  }

  return { simple, fixed };
})();
