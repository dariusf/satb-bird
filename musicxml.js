let MusicXML = (function () {
  let onScoreLoaded;

  let down_one = {
    C: 'B',
    'C#': 'C',
    D: 'C#',
    'D#': 'D',
    E: 'D#',
    F: 'E',
    'F#': 'F',
    G: 'F#',
    'G#': 'G',
    A: 'G#',
    'A#': 'A',
    B: 'A#',
  };

  async function loadScoreURL(url) {
    // url can be relative to load from the repo
    const response = await fetch(url);
    const str = await response.text();
    onMusicXMLLoad(url.split('/').pop(), onScoreLoaded, str);
    // TODO error-handling
  }

  function readFile(file) {
    var reader = new FileReader();
    reader.onload = () => {
      onMusicXMLLoad(file.name, onScoreLoaded, reader.result);
    };
    reader.readAsText(file);
  }

  function onMusicXMLLoad(name, resolve, data) {
    if (typeof data === 'string') {
      const parser = new DOMParser();
      data = parser.parseFromString(data, 'application/xml');
    } else if (data instanceof XMLDocument) {
      console.log('xml document loaded');
    } else {
      console.log('not a valid format:', (data && data.constructor) || data);
    }

    try {
      name = data.evaluate('/score-partwise/work/work-title/text()', data).iterateNext().data;
    } catch (e) {
      try {
        name = data
          .evaluate('/score-partwise/credit[credit-type = "title"]/credit-words/text()', data)
          .iterateNext().data;
      } catch (e) {}
    }

    var composer = 'Unknown';
    try {
      composer = data.evaluate('/score-partwise/identification/creator/text()', data).iterateNext().data;
    } catch (e) {
      try {
        composer = data
          .evaluate('/score-partwise/credit[credit-type = "composer"]/credit-words/text()', data)
          .iterateNext().data;
      } catch (e) {}
    }

    var parts = toList(data.evaluate('/score-partwise/part-list/score-part', data)).map((p) => ({
      id: p.id,
      name: p.children[0].textContent,
    }));

    window.score = {
      name: name,
      composer: composer,
      parts: {},
    };

    parts.forEach((p) => {
      var measures = toList(data.evaluate('/score-partwise/part[@id="' + p.id + '"]', data))[0].children;

      // TODO assumes only one timing throughout

      // each quarter note is 4 divisions, this changes per measure
      var divisions = Number.parseInt(
        toList(data.evaluate('/score-partwise/part[@id="' + p.id + '"]/measure/attributes/divisions/text()', data))[0]
          .data
      );

      // 2/2, 4/4, etc.
      var beats = 4;
      try {
        beats = Number.parseInt(
          toList(
            data.evaluate('/score-partwise/part[@id="' + p.id + '"]/measure/attributes/time/beats/text()', data)
          )[0].data
        );
      } catch (e) {}

      var beatType = 4;
      try {
        beatType = Number.parseInt(
          toList(
            data.evaluate('/score-partwise/part[@id="' + p.id + '"]/measure/attributes/time/beat-type/text()', data)
          )[0].data
        );
      } catch (e) {}

      // quarter note = 120 bpm; musescore's default
      // var tempo = 120;
      var tempo = 80;

      try {
        tempo = +data.evaluate('/score-partwise/part/measure/direction/sound/@tempo', data).iterateNext().value;
      } catch (e) {}

      function list(xs) {
        return Array.prototype.slice.call(xs);
      }

      function nav(elt, tag) {
        return list(elt.children).filter((c) => c.tagName === tag);
      }

      // get notes from measures
      var notes = list(measures).map((m) =>
        list(m.children)
          .filter((e) => e.tagName === 'note')
          .map((n) => {
            var res = {
              duration: Number.parseInt(nav(n, 'duration')[0].textContent),
            };
            var rest = nav(n, 'rest').length != 0;
            if (rest) {
              res.rest = rest;
            } else {
              var p = nav(n, 'pitch')[0];
              var note = p.querySelector('step').textContent;
              var alter = p.querySelector('alter');
              if (alter) {
                if (alter.textContent == '1') {
                  note += '#';
                } else if (alter.textContent == '-1') {
                  note = down_one[note];
                } else {
                  console.assert(false, 'invalid alter ' + alter);
                }
              }
              var octave = Number.parseInt(p.querySelector('octave').textContent);
              res.pitch = { note, octave };
              let lyrics_text = n.querySelector('lyric text');
              if (lyrics_text === null) {
                res.lyrics = '';
              } else {
                res.lyrics = lyrics_text.textContent;
                let syl = n.querySelector('lyric syllabic')?.textContent;
                switch (syl) {
                  case 'middle':
                    res.lyrics = `-${res.lyrics}-`;
                    break;
                  case 'begin':
                    res.lyrics = `${res.lyrics}-`;
                    break;
                  case 'end':
                    res.lyrics = `-${res.lyrics}`;
                    break;
                }
              }
            }
            return res;
          })
      );

      function uniq(xs, on) {
        return xs.filter((item, pos, ary) => !pos || on(item) != on(ary[pos - 1]));
      }

      let ordered = notes
        .flat()
        .filter((n) => n.pitch)
        .map((n) => n.pitch.note + n.pitch.octave)
        .map((n) => [n, freqTable[440].findIndex((m) => m.note == n)]);

      ordered.sort(([_, a], [_n, b]) => a - b);
      ordered = uniq(ordered, (x) => x[0]);

      let [topNote, topi] = ordered[ordered.length - 1];
      let [bottomNote, boti] = ordered[0];

      function onedp(num) {
        return Math.round(num * 10) / 10;
      }

      let semitones = topi - boti;
      let numOctaves = onedp(semitones / 12);

      // high to low, as higher notes are nearer the origin
      let botIdx = freqTable[440].findIndex((m) => m.note === bottomNote);
      let allNotes = freqTable[440]
        .slice(botIdx, botIdx + semitones + 1)
        .map((n) => n.note)
        .reverse();
      // ordered.map((n) => n[0]);
      // note that ordered isn't the same as allNotes
      // as there may be notes in range which are never sung

      // debugger;
      // shaped(allNotes.length, (l) => l === semitones);

      score.parts[p.name] = {
        tempo: tempo,
        time: [beats, beatType],
        divisions: divisions,
        notes: notes,
        range: {
          top: topNote,
          bottom: bottomNote,
          octaves: numOctaves,
          // semitones,
          notes: allNotes,
        },
      };
    });

    resolve(score);
  }

  function init(f) {
    onScoreLoaded = f;
  }

  return { readFile, loadScoreURL, init };
})();
