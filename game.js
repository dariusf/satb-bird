let { gameStart, handleInput } = (function () {
  var NO_PIPES = false;
  var INVULNERABLE = true;
  var DEFAULT_RANDOM_PIPES = false;
  var ON_END = () => {};
  var ON_START = () => {};

  let PART;
  const PIPE_SPEED = 5;
  const BIRD_X = 140;
  const BREATHING_TIME = 5;
  const BIRD_SPEED = 15;

  let flappyNote;

  // why is this useful? see:
  // https://dbaron.org/log/20100309-faster-timeouts
  (function () {
    var timeouts = [];
    var messageName = 'zero-timeout-message';

    function setZeroTimeout(fn) {
      timeouts.push(fn);
      window.postMessage(messageName, '*');
    }

    function handleMessage(event) {
      if (event.source == window && event.data == messageName) {
        event.stopPropagation();
        if (timeouts.length > 0) {
          var fn = timeouts.shift();
          fn();
        }
      }
    }

    window.addEventListener('message', handleMessage, true);

    window.setZeroTimeout = setZeroTimeout;
  })();

  var game;
  var FPS = 60;
  var SPF = 1 / FPS;
  let MSPF = 1000 * SPF;
  // var maxScore = 0;

  var images = {};

  // this seems to be for interactively setting fps,
  // with the most useful value being 0 for maximum speed
  var speed = function (fps) {
    FPS = parseInt(fps);
  };

  var loadImages = function (sources, callback) {
    var nb = 0;
    var loaded = 0;
    var imgs = {};
    for (var i in sources) {
      nb++;
      imgs[i] = new Image();
      imgs[i].src = sources[i];
      imgs[i].onload = function () {
        loaded++;
        if (loaded == nb) {
          callback(imgs);
        }
      };
    }
  };

  var Bird = function (json) {
    this.x = BIRD_X;
    this.y = 250;
    this.width = 40;
    this.height = 30;

    this.alive = true;
    this.gravity = 0;
    this.velocity = 0.3;
    this.jump = -6;

    this.init(json);
  };

  Bird.prototype.init = function (json) {
    for (var i in json) {
      this[i] = json[i];
    }
  };

  Bird.prototype.flap = function () {
    this.gravity = this.jump;
  };

  Bird.prototype.sing = function () {
    if (!flappyNote) {
      this.gravity = 0;
      return;
    }
    shaped(flappyNote, isNote);
    let dest = game.noteToPosition(flappyNote);
    let dir;
    if (Math.abs(dest - this.y) < BIRD_SPEED) {
      this.y = dest;
      dir = 0;
    } else if (dest < this.y) {
      dir = -1;
    } else {
      dir = 1;
    }
    this.gravity = dir * BIRD_SPEED;
  };

  Bird.prototype.update = function () {
    // gravity is really the downward velocity
    // temporarily disabled as we're not using flapping controls
    // this.gravity += this.velocity;

    this.y += this.gravity;
  };

  Bird.prototype.isDead = function (height, pipes) {
    if (INVULNERABLE) {
      return false;
    }
    if (this.y >= height || this.y + this.height <= 0) {
      return true;
    }
    for (var i in pipes) {
      let { top, bot } = pipes[i];
      for (let p in [top, bot]) {
        if (
          !(
            this.x > p.x + p.width ||
            this.x + this.width < p.x ||
            this.y > p.y + p.height ||
            this.y + this.height < p.y
          )
        ) {
          return true;
        }
      }
    }
  };

  var Pipe = function (json) {
    this.x = 0;
    this.y = 0;
    this.width = 50;
    this.height = 40;
    this.speed = PIPE_SPEED;

    this.init(json);
  };

  Pipe.prototype.init = function (json) {
    for (var i in json) {
      this[i] = json[i];
    }
  };

  Pipe.prototype.update = function () {
    this.x -= this.speed;
  };

  Pipe.prototype.isOut = function () {
    if (this.x + this.width < 0) {
      return true;
    }
  };

  var Game = function () {
    this.pipes = [];
    this.birds = [];
    this.canvas = document.querySelector('#flappy');

    // make the canvas full screen
    this.canvas.width = Math.min(2048, document.body.clientWidth);
    this.canvas.height = Math.min(512, document.body.clientHeight);

    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    ON_START();

    // the amount of time in seconds for a pipe spawning at the right edge to reach the bird.
    // also the amount of time by which to delay the music.
    this.bird_to_right_edge_time = (this.width - BIRD_X) / (PIPE_SPEED * FPS);

    // only used for random pipe mode
    this.spawnInterval = NO_PIPES ? Number.MAX_VALUE : 90;

    // controls pipe spawns
    this.timeElapsed = 0;

    // time the game will wait after the last note is passed
    this.gameEnded = BREATHING_TIME;

    this.backgroundSpeed = 0.5;
    this.backgroundx = 0;
  };

  Game.prototype.noteToPosition = function (noteName) {
    // ----^-----------
    //     | padding
    //     |
    // ----v      ^
    //            | hole 2
    // ----   ^   v
    //        | hole 1
    // ----^  v
    //     |
    //     | padding (currently absent)
    // ----v-----------

    let padding = 120;
    let notes = PART.range.notes;
    let idx = notes.indexOf(noteName);
    let y = ((this.height - padding * 2) / notes.length) * idx + padding;
    return y;
  };

  Game.prototype.start = function () {
    this.timeElapsed = NO_PIPES ? 1 : 0;
    this.pipes = [];
    this.birds = [];

    var b = new Bird();
    this.birds.push(b);

    if (DEFAULT_RANDOM_PIPES) {
      return;
    }

    let part = PART;

    // compute time offsets for where the pipes should be,
    // and the positions of hole centres.
    // (next: pipePositions)
    let pipePositions = [];
    let time = 0;
    for (const n of part.notes) {
      let dur = durationToTime(part.tempo, part.divisions, n.duration);

      let start = time;
      time += dur;
      let end = time;

      if (!n.rest) {
        let noteName = n.pitch.note + n.pitch.octave;
        let y = this.noteToPosition(noteName);
        pipePositions.push({ start, end, y, note: n });
      }
    }

    this.pipePositions = pipePositions;
    // TODO time signature may change halfway
  };

  Game.prototype.debugPoint = function (x, y) {
    this.ctx.save();
    this.ctx.fillStyle = '#f00';
    this.ctx.rect(x - 5, y - 5, 10, 10);
    this.ctx.stroke();
    this.ctx.restore();
  };

  // this spawns new pipes on the right side when it's time.
  // given the hole centres, compute where to place the graphics.
  // next: pipetop
  Game.prototype.spawnPipe = function (pipe) {
    //                                      +------+       ^
    //                                      |      |       |
    //                                      |      |       |
    //                 0,0                  |      |       |
    //             ^    +--------------^-----------------+ |
    //             |    |              |  y |      |     | |
    //             |    |              |    |      |     | |
    //             |    |              |    |      |     | | image
    //             |    |              |    |      |     | | height
    //             |    |       pipe   |    |      |     | |
    //             |    |       height |    |      |     | |
    //             |    |              |    |      |     | |
    //             |    |              |    |      |     | |
    //             |    |              |    |      |     | |
    //             |    |          ^   v    +------+     | v
    // this.height |    |   hole   |                     |
    //             |    |   height |                     |
    //             |    |          |                     |
    //             |    |          v   ^  y +------+     | ^
    //             |    |              |    |      |     | |
    //             |    |              |    |      |     | |
    //             |    |              |    |      |     | |
    //             |    |       pipe   |    |      |     | |
    //             |    |       height |    |      |     | | image
    //             |    |              |    |      |     | | height
    //             |    |              |    |      |     | |
    //             |    |              |    |      |     | |
    //             |    |              |    |      |     | |
    //             v    +--------------v-----------------+ |
    //                                      |      |       |
    //                                      |      |       |
    //                                      +------+       v

    // the height of the hole
    var holeHeight = 120;

    // the y coord of the top left of the hole
    if (pipe) {
      var holeTLY = pipe.y - holeHeight / 2;
    } else {
      // holes will spawn within 50 units of the top and bottom
      var padding = 50;
      var holeTLY = Math.round(Math.random() * (this.height - padding * 2 - holeHeight)) + padding;
    }

    // debugPoint(this.width, 0);
    // this.debugPoint(this.width, holeTLY);
    // this.debugPoint(this.width, holeTLY + holeHeight);

    // odd elements are top pipes and their x y is at the bottom left,
    // whereas even elements have their x y at the top left
    this.pipes.push({
      top: new Pipe({ x: this.width, y: 0, height: holeTLY }),
      bot: new Pipe({
        x: this.width,
        y: holeTLY + holeHeight,
        height: this.height,
      }),
      note: pipe.note,
      hole: pipe.y,
    });
  };

  Game.prototype.update = function () {
    this.backgroundx += this.backgroundSpeed;

    // flap (or sing)
    for (var pipe in this.birds) {
      if (this.birds[pipe].alive) {
        this.birds[pipe].sing();
        this.birds[pipe].update();
        if (this.birds[pipe].isDead(this.height, this.pipes)) {
          this.birds[pipe].alive = false;
          this.alives--;
          if (this.isItEnd()) {
            this.start();
          }
        }
      }
    }

    // move and remove pipes
    for (var pipe = 0; pipe < this.pipes.length; pipe++) {
      this.pipes[pipe].top.update();
      this.pipes[pipe].bot.update();
      if (this.pipes[pipe].top.isOut()) {
        this.pipes.splice(pipe, 1);
        pipe--;
      }
    }

    if (DEFAULT_RANDOM_PIPES) {
      if (this.timeElapsed == 0) {
        this.spawnPipe(null);
      }

      this.timeElapsed++;
      if (this.timeElapsed == this.spawnInterval) {
        this.timeElapsed = 0;
      }
    } else {
      // create pipes based on score
      // this.interval += this.divisions_per_frame;
      this.timeElapsed += 1 / FPS;
      if (this.pipePositions.length === 0) {
        // we're done!
        // DEFAULT_RANDOM_PIPES = true;
        this.gameEnded -= SPF;
      } else if (this.timeElapsed > this.pipePositions[0].start) {
        var pipe = this.pipePositions.shift();
        this.spawnPipe(pipe);
        // console.log('pipe spawned', pipe.note);
      }
    }

    // this.score++;
    // this.maxScore = (this.score > this.maxScore) ? this.score : this.maxScore;

    if (this.gameEnded < 0) {
      this.stop();
      return;
    }

    if (FPS == 0) {
      setZeroTimeout(() => this.update());
    } else {
      // TODO request animation frame?
      setTimeout(() => this.update(), MSPF);
    }
  };

  Game.prototype.stop = function () {
    ON_END();
  };

  Game.prototype.isItEnd = function () {
    for (var i in this.birds) {
      if (this.birds[i].alive) {
        return false;
      }
    }
    return true;
  };

  Game.prototype.display = function () {
    this.ctx.clearRect(0, 0, this.width, this.height);
    for (var i = 0; i < Math.ceil(this.width / images.background.width) + 1; i++) {
      this.ctx.drawImage(
        images.background,
        i * images.background.width - Math.floor(this.backgroundx % images.background.width),
        0
      );
    }

    // given the positions of the graphics, compute where to draw them,
    // and also where to render lyrics
    for (let i in this.pipes) {
      let { top, bot, hole, note } = this.pipes[i];
      // drawImage(img, x, y, width, height)
      this.ctx.drawImage(
        images.pipetop,
        top.x,
        top.y + top.height - images.pipetop.height,
        top.width,
        images.pipetop.height
      );
      this.ctx.save();
      this.ctx.fillStyle = '#000';
      this.ctx.font = '30px ui-rounded, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(note.lyrics ?? '', top.x + top.width / 2, hole);
      this.ctx.restore();
      this.ctx.drawImage(images.pipebottom, bot.x, bot.y, bot.width, images.pipetop.height);
    }

    // let debug = false;
    // let debug = true;

    // if (debug) {
    //   this.ctx.save();
    //   this.ctx.fillStyle = '#000';
    //   for (let i = 0; i < PART.range.notes.length; i++) {
    //     this.ctx.fillText(i, 200, this.height - i * (this.height / PART.range.notes.length));
    //   }
    //   // this.ctx.beginPath();
    //   // this.ctx.moveTo(10, 45);
    //   // this.ctx.lineTo(180, 47);
    //   // this.ctx.stroke();
    //   this.ctx.restore();
    // }

    this.ctx.fillStyle = '#FFC600';
    this.ctx.strokeStyle = '#CE9E00';
    for (var i in this.birds) {
      if (this.birds[i].alive) {
        this.ctx.save();
        this.ctx.translate(this.birds[i].x + this.birds[i].width / 2, this.birds[i].y + this.birds[i].height / 2);
        this.ctx.rotate(((Math.PI / 2) * this.birds[i].gravity) / 20);
        this.ctx.drawImage(
          images.bird,
          -this.birds[i].width / 2,
          -this.birds[i].height / 2,
          this.birds[i].width,
          this.birds[i].height
        );
        this.ctx.restore();
      }
    }

    this.ctx.fillStyle = 'white';
    // this.ctx.font="20px Oswald, sans-serif";
    // this.ctx.fillText("Score : "+ this.score, 10, 25);
    // this.ctx.fillText("Max Score : "+this.maxScore, 10, 50);
    // this.ctx.fillText("Generation : "+this.generation, 10, 75);
    // this.ctx.fillText("Alive : "+this.alives+" / "+Neuvol.options.population, 10, 100);

    var self = this;
    requestAnimationFrame(function () {
      self.display();
    });
  };

  window.onload = function () {
    var sprites = {
      bird: './img/bird.png',
      background: './img/background.png',
      pipetop: './img/pipetop.png',
      pipebottom: './img/pipebottom.png',
    };

    loadImages(sprites, function (imgs) {
      images = imgs;
    });
  };

  function gameStart({ randomPipes, part, onEnd, onStart }) {
    DEFAULT_RANDOM_PIPES = randomPipes;
    ON_END = onEnd;
    ON_START = onStart;
    PART = part;
    game = new Game();
    game.start();
    game.update();
    game.display();
    return game.bird_to_right_edge_time;
  }

  let notesInRange;
  function handleInput(note) {
    if (PART.range.notes.indexOf(note) > -1) {
      if (!notesInRange) {
        notesInRange = {};
        PART.range.notes.forEach((n) => (notesInRange[n] = true));
      }
      if (notesInRange[note]) {
        flappyNote = note;
      }
    }
  }

  return { gameStart, handleInput };
})();
