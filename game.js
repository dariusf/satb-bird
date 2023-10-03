let { gameStart, handleInput, gameStop } = (function () {
  var NO_PIPES = false;
  var INVULNERABLE = true;
  var DEFAULT_RANDOM_PIPES = false;
  var ON_END = () => {};
  var ON_START = () => {};
  var ON_PIPE_PASSED = () => {};
  var ON_PIPE_ENCOUNTERED = () => {};

  let SHOW_NOTE_BEING_SUNG;
  let AI_ENABLED;
  let MOVEMENT_KIND;

  let PART;
  const PIPE_SPEED = 300; // in units per second
  // pipe_speed * dt = how much to move per update
  // d/s * s/f = d/f
  const BACKGROUND_SPEED = 30;

  const BIRD_X = 140;
  const BREATHING_TIME = 5;

  let flappyNote;

  let game;

  let images = {};

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

  Bird.prototype.sing = function (dt) {
    if (AI_ENABLED) {
      function closestPoint(p) {
        return p.top.x - p.top.width / 2;
      }
      let nextPipe = game.pipes.reduce(
        (t, c) => {
          let { dist } = t;
          let p = closestPoint(c);
          let d = p - this.x;
          let isUpcoming = this.x <= p;
          let isNearest = d <= dist;
          // don't react to pipes which are too close
          let isNear = 10 <= d && d <= 40;
          if (isNear && isUpcoming && isNearest) {
            return { dist: d, pipe: c };
          } else {
            return t;
          }
        },
        { pipe: null, dist: Infinity }
      ).pipe;
      if (nextPipe) {
        flappyNote = { note: noteToImplicit(nextPipe.note.pitch), cents: 0 };
      }
    }

    if (flappyNote) {
      shaped(flappyNote, noteCents);
      let dest = game.noteToPosition(flappyNote);
      let dir;
      if (Math.abs(dest - this.y) < epsilon) {
        dir = 0;
      } else if (dest < this.y) {
        dir = -1;
      } else {
        dir = 1;
      }

      let wobbly = () => {
        const BIRD_SPEED = 500;
        const BIRD_ACC = 30;
        if (!flappyNote) {
          this.velocity = Math.max(0, this.velocity - BIRD_ACC * dt);
        } else {
          this.velocity += dir * BIRD_ACC * dt;
        }
        this.dir = 1;
        this.velocity = clamp(-BIRD_SPEED * dt, this.velocity, BIRD_SPEED * dt);
        this.y += this.velocity;
      };

      // https://gamedev.stackexchange.com/questions/73627
      let precise = () => {
        // 30 is aesthetically pleasing but not enough for leaps
        // const BIRD_ACC = 30;
        const BIRD_SPEED = 1200;
        const BIRD_ACC = 70;

        // compute unsigned velocity
        let dist = Math.abs(dest - this.y);
        let decelDistance = (this.velocity * this.velocity) / (2 * BIRD_ACC);
        if (dist > decelDistance) {
          // continue accelerating
          this.velocity = Math.min(this.velocity + BIRD_ACC * dt, BIRD_SPEED * dt);
        } else {
          // start decelerate
          this.velocity = Math.max(this.velocity - BIRD_ACC * dt, 0);
        }
        this.dir = dir;

        if (dist < this.velocity) {
          this.y = dest;
        } else {
          this.y += dir * this.velocity;
        }
      };

      if (MOVEMENT_KIND === 'wobbly') {
        wobbly();
      } else {
        precise();
      }
    }
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

    this.init(json);
  };

  Pipe.prototype.init = function (json) {
    for (var i in json) {
      this[i] = json[i];
    }
  };

  Pipe.prototype.update = function (dt) {
    this.x -= PIPE_SPEED * dt;
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
    this.bird_to_right_edge_time = (this.width - BIRD_X) / PIPE_SPEED;

    // only used for random pipe mode
    this.spawnInterval = NO_PIPES ? Number.MAX_VALUE : 90;

    // controls pipe spawns
    this.timeElapsed = 0;

    // time the game will wait after the last note is passed
    this.gameEnded = BREATHING_TIME;

    this.backgroundx = 0;
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

    // notes within the range of the part, including notes not actually sung.
    // this must be used if the (virtual) staff should be laid out like in a score
    this.partFullRange = NOTES_SEQ.slice(NOTE_TO_IDX[PART.range.bottom], NOTE_TO_IDX[PART.range.top] + 1).reverse();
    this.staffLineNotes = ['F5', 'D5', 'B4', 'G4', 'E4', 'A3', 'F3', 'D3', 'B2', 'G2'].filter(
      (n) => this.partFullRange.indexOf(n) > -1
    );

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
        let y = this.noteToPosition({ note: noteToImplicit(n.pitch), cents: 0 });
        pipePositions.push({ start, end, y, note: n });
      }
    }

    this.pipePositions = pipePositions;
    // TODO time signature may change halfway
  };

  Game.prototype.noteToPosition = function ({ note, cents }) {
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

    let padding = 50; // should be smaller than the gap between staff lines
    let notes = this.partFullRange;
    let idx = notes.indexOf(note);
    let pipeDist = (this.height - padding * 2) / notes.length;
    let inacc = pipeDist * (cents / 100);
    let y = pipeDist * idx + inacc + padding;
    return y;
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

  Game.prototype.update = function (dt) {
    this.backgroundx += BACKGROUND_SPEED * dt;

    // flap (or sing)
    for (let b in this.birds) {
      if (this.birds[b].alive) {
        this.birds[b].sing(dt);
        // this.birds[pipe].update(dt);
        if (this.birds[b].isDead(this.height, this.pipes)) {
          this.birds[b].alive = false;
          this.alives--;
          if (this.isItEnd()) {
            this.start();
          }
        }
      }
    }

    // move and remove pipes
    for (let p = 0; p < this.pipes.length; p++) {
      let rightBefore = this.pipes[p].top.x + this.pipes[p].top.width;
      let leftBefore = this.pipes[p].top.x;
      // let centerBefore = this.pipes[p].top.x + this.pipes[p].top.width / 2;
      this.pipes[p].top.update(dt);
      this.pipes[p].bot.update(dt);
      let rightAfter = this.pipes[p].top.x + this.pipes[p].top.width;
      let leftAfter = this.pipes[p].top.x;
      // let centerAfter = this.pipes[p].top.x + this.pipes[p].top.width / 2;

      for (let b in this.birds) {
        let bird_right = this.birds[b].x + this.birds[b].width / 2;

        // trigger a bit in advance
        let bird_left = this.birds[b].x - this.birds[b].width / 2 + 50;

        if (rightAfter <= bird_right && bird_right <= rightBefore) {
          ON_PIPE_PASSED();
        }
        if (leftAfter <= bird_left && bird_left <= leftBefore) {
          ON_PIPE_ENCOUNTERED();
        }
      }

      if (this.pipes[p].top.isOut()) {
        this.pipes.splice(p, 1);
        p--;
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
      this.timeElapsed += dt;
      if (this.pipePositions.length === 0) {
        // we're done!
        // DEFAULT_RANDOM_PIPES = true;
        this.gameEnded -= dt;
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
  };

  Game.prototype.stop = function () {
    this.stopGameLoop();
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

    // draw staff lines behind pipes
    let renderStaffLines = false;
    if (renderStaffLines) {
      this.ctx.save();
      this.ctx.lineWidth = 4;
      this.ctx.strokeStyle = '#eeeeee';
      this.ctx.strokeStyle = 'rgba(240, 240, 240, 0.3)';
      for (const n of this.staffLineNotes) {
        let y = this.noteToPosition({ note: n, cents: 0 });
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.width, y);
        // this.ctx.font = '18px ui-rounded, sans-serif';
        // this.ctx.fillText(n, 100, y);
        // console.log(n, y);
        // TODO if we render staff lines like this, they won't be evenly spaced, because actual staff lines are not evenly spaced; there may or may not be accidentals between them
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // TODO render clefs
    // font size depends on the height between lines
    // also needs to be offset to be positioned at the right line, or not drawn at all if not on-screen
    let renderClef = false;
    if (renderClef) {
      this.ctx.save();
      this.ctx.font = '330px ui-rounded, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('𝄞', this.birds[0].x, this.birds[0].y);
      this.ctx.fillText('𝄢', this.birds[0].x, this.birds[0].y);
      this.ctx.restore();
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

        // draw note, while we're at bird position
        if (SHOW_NOTE_BEING_SUNG && flappyNote) {
          this.ctx.save();
          this.ctx.fillStyle = '#000';
          this.ctx.font = '25px ui-rounded, sans-serif';
          this.ctx.textAlign = 'center';
          // this.ctx.fillText(flappyNote.note, this.birds[i].x + 100, this.birds[i].y);
          this.ctx.fillText(flappyNote.note, 50, 0);
          this.ctx.restore();
        }

        this.ctx.rotate(((Math.PI / 2) * this.birds[i].dir * this.birds[i].velocity) / 20);
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

    // var self = this;
    // requestAnimationFrame(function () {
    //   self.display();
    // });
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

  function gameStop() {
    game.stop();
  }
  function gameStart({
    randomPipes,
    part,
    onEnd,
    onStart,
    ai,
    movement,
    onPipePassed,
    onPipeEncountered,
    noteBeingSung,
  }) {
    AI_ENABLED = ai;
    MOVEMENT_KIND = movement;
    SHOW_NOTE_BEING_SUNG = noteBeingSung;
    DEFAULT_RANDOM_PIPES = randomPipes;
    ON_END = onEnd;
    ON_START = onStart;
    ON_PIPE_PASSED = onPipePassed || ON_PIPE_PASSED;
    ON_PIPE_ENCOUNTERED = onPipeEncountered || ON_PIPE_ENCOUNTERED;
    PART = part;
    game = new Game();
    game.start();
    game.stopGameLoop = GameLoop.fixed(
      60,
      (dt) => {
        game.update(dt);
      },
      (_alpha) =>
        // TODO
        game.display()
    );
    return game.bird_to_right_edge_time;
  }

  let notesInRange;
  function handleInput(note) {
    shaped(note, noteCents);
    if (!notesInRange) {
      notesInRange = {};
      PART.range.notes.forEach((n) => (notesInRange[n] = true));
    }
    if (notesInRange[note.note]) {
      flappyNote = note;
    }
  }

  return { gameStart, handleInput, gameStop };
})();
