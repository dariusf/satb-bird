let { gameStart, handleInput } = (function () {
  var NO_PIPES = false;
  var INVULNERABLE = true;
  var DEFAULT_RANDOM_PIPES = false;

  // TODO good default from calibration
  let flappyNote = 6;
  let lastNote;

  // why is this useful? see:
  // https://dbaron.org/log/20100309-faster-timeouts
  // https://blog.klipse.tech/javascript/2016/10/31/setTimeout-0msec.html
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
  var maxScore = 0;

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
    this.x = 80;
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

  Bird.prototype.sing = function (levelHeight) {
    var increments = levelHeight / 12;
    lastNote = lastNote || 6;
    var dest = flappyNote || lastNote;
    lastNote = dest;
    var current = this.y / increments;
    var speed = 5;
    this.gravity = (dest - current) * speed;
  };

  Bird.prototype.update = function () {
    this.gravity += this.velocity;
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
      if (
        !(
          this.x > pipes[i].x + pipes[i].width ||
          this.x + this.width < pipes[i].x ||
          this.y > pipes[i].y + pipes[i].height ||
          this.y + this.height < pipes[i].y
        )
      ) {
        return true;
      }
    }
  };

  var Pipe = function (json) {
    this.x = 0;
    this.y = 0;
    this.width = 50;
    this.height = 40;
    this.speed = 3;

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
    this.score = 0;
    this.canvas = document.querySelector('#flappy');
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this.spawnInterval = NO_PIPES ? Number.MAX_VALUE : 90;
    this.interval = 0;

    // this.gen = [];
    // this.alives = 0;
    // this.generation = 0;
    this.backgroundSpeed = 0.5;
    this.backgroundx = 0;
    this.maxScore = 0;
  };

  Game.prototype.start = function () {
    this.interval = NO_PIPES ? 1 : 0;
    this.score = 0;
    this.pipes = [];
    this.birds = [];

    // for(var i in this.gen){
    // 	var b = new Bird();
    // 	this.birds.push(b)
    // }

    var b = new Bird();
    this.birds.push(b);

    // this.generation++;
    // this.alives = this.birds.length;

    // score

    if (DEFAULT_RANDOM_PIPES) {
      return;
    }

    var part = score.parts.Bass || score.parts[Object.keys(score.parts)[Object.keys(score.parts).length - 1]];
    var bps = (part.tempo / 60) * (part.time[1] / 4);
    var frames_per_beat = FPS / bps;
    console.log('frames_per_beat', frames_per_beat);
    // TODO instead of doing this, offset the pipe backwards by the difference
    frames_per_beat = Math.floor(frames_per_beat);

    var divs_per_bar = part.divisions * (4 / part.time[1]) * part.time[0];
    this.divisions_per_frame = divs_per_bar / part.time[0] / frames_per_beat;
    // this.divisions_per_frame = 1 / this.divisions_per_frame;

    // TODO determine range from score
    // new Set(score.parts.Tenor.notes.flatMap(n => n).filter(n => !n.rest).map(n => n.pitch.note + n.pitch.octave))

    // process all notes
    var soFar = 0;
    var intervals = [];
    part.notes.forEach((m) => {
      m.forEach((n) => {
        if (!n.rest) {
          intervals.push({
            time: soFar,
            pos: (this.height / 12) * notePositions[n.pitch.note],
          });
        }
        soFar += n.duration;
      });
    });

    this.intervals = intervals;
    // TODO time signature may change halfway

    console.log(this.divisions_per_frame, this.intervals);
  };

  Game.prototype.update = function () {
    this.backgroundx += this.backgroundSpeed;
    var nextHoll = 0; // hole?
    if (this.birds.length > 0) {
      for (var i = 0; i < this.pipes.length; i += 2) {
        // once the bird clears the pipe completely
        if (this.pipes[i].x + this.pipes[i].width > this.birds[0].x) {
          nextHoll = this.pipes[i].height / this.height;
          break;
        }
      }
    }

    for (var i in this.birds) {
      if (this.birds[i].alive) {
        // var inputs = [
        // this.birds[i].y / this.height,
        // nextHoll
        // ];

        // var res = this.gen[i].compute(inputs);
        // if(res > 0.5){
        // this.birds[i].flap();

        // this.target = this.target || 0;
        // this.target ++;

        this.birds[i].sing(this.height);
        // }

        this.birds[i].update();
        if (this.birds[i].isDead(this.height, this.pipes)) {
          this.birds[i].alive = false;
          this.alives--;
          //console.log(this.alives);
          // Neuvol.networkScore(this.gen[i], this.score);
          if (this.isItEnd()) {
            this.start();
          }
        }
      }
    }

    for (var i = 0; i < this.pipes.length; i++) {
      this.pipes[i].update();
      if (this.pipes[i].isOut()) {
        this.pipes.splice(i, 1);
        i--;
      }
    }

    var that = this;
    function debugPoint(x, y) {
      that.ctx.save();
      that.ctx.rect(x - 5, y - 5, 10, 10);
      that.ctx.stroke();
      that.ctx.restore();
    }

    // this spawns new pipes on the right side
    // TODO need to be tweaked a lot to correspond to notes
    var spawnPipe = (pos) => {
      // holes will spawn within 50 units of the top and bottom
      var deltaBord = 50;

      //                                      +------+       ^
      //                                      |      |       |
      //                                      |      |       |
      //                                      |      |       |
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
      var pipeHoll = 120;

      // the y coord of the top left of the hole
      if (pos) {
        var hollPosition = pos - pipeHoll / 2;
      } else {
        var hollPosition = Math.round(Math.random() * (this.height - deltaBord * 2 - pipeHoll)) + deltaBord;
      }

      // debugPoint(this.width, 0);
      debugPoint(this.width, hollPosition);
      debugPoint(this.width, hollPosition + pipeHoll);

      // the coords are different for each pipe:
      // the odd elements are top pipes and their x y is at the bottom left,
      // whereas even elements have their x y at the top left
      this.pipes.push(new Pipe({ x: this.width, y: 0, height: hollPosition }));
      this.pipes.push(
        new Pipe({
          x: this.width,
          y: hollPosition + pipeHoll,
          height: this.height,
        })
      );
    };

    if (DEFAULT_RANDOM_PIPES) {
      if (this.interval == 0) {
        spawnPipe();
      }

      this.interval++;
      if (this.interval == this.spawnInterval) {
        this.interval = 0;
      }
    } else {
      // create pipes based on score
      this.interval += this.divisions_per_frame;
      if (this.intervals.length === 0) {
        // we're done!
        DEFAULT_RANDOM_PIPES = true;
      } else if (this.interval > this.intervals[0].time) {
        var i = this.intervals.shift();
        spawnPipe(i.pos);
      }
    }

    // TODO holes

    // this.score++;
    // this.maxScore = (this.score > this.maxScore) ? this.score : this.maxScore;
    var self = this;

    if (FPS == 0) {
      setZeroTimeout(function () {
        self.update();
      });
    } else {
      // TODO set animation frame?
      setTimeout(function () {
        self.update();
      }, 1000 / FPS);
    }
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

    for (var i in this.pipes) {
      if (i % 2 == 0) {
        // drawImage(img, x, y, width, height)
        this.ctx.drawImage(
          images.pipetop,
          this.pipes[i].x,
          this.pipes[i].y + this.pipes[i].height - images.pipetop.height,
          this.pipes[i].width,
          images.pipetop.height
        );
      } else {
        this.ctx.drawImage(
          images.pipebottom,
          this.pipes[i].x,
          this.pipes[i].y,
          this.pipes[i].width,
          images.pipetop.height
        );
      }
    }

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

  function start({ randomPipes }) {
    DEFAULT_RANDOM_PIPES = randomPipes;
    game = new Game();
    game.start();
    game.update();
    game.display();
  }

  function handleInput(note) {
    // TODO temporarily
    note = note.replace(/\d+/, '');

    flappyNote = notePositions[note];
  }

  return { gameStart: start, handleInput };
})();
