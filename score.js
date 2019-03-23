
function loadScore(url) {
  return new Promise(function (resolve, reject) {
    $.ajax({
      type: "GET",
      url: url, // can be relative to load from the repo
      dataType: "xml",
      success: onScoreLoad.bind(null, resolve)
    });
  });
}

function readUploadedScore() {
  var reader = new FileReader();
  reader.onload = e => {
    onScoreLoad(startGame, reader.result);
  };
  let name = $('#scoreFile')[0].files[0];
  reader.readAsText(name);
}

function onScoreLoad(resolve, data) {

  if (typeof data === 'string') {
    const parser = new DOMParser();
    data = parser.parseFromString(data, "application/xml");
    console.log('xml loaded');
  } else if (data instanceof XMLDocument) {
    console.log('xml document loaded');
  } else {
    console.log('not a valid format:', data && data.constructor || data);
  }

  var name = data.evaluate('/score-partwise/work/work-title/text()', data).iterateNext().data;
  var composer = data.evaluate('/score-partwise/identification/creator/text()', data).iterateNext().data;

  var parts = toList(data.evaluate('/score-partwise/part-list/score-part', data)).map(p => ({ id: p.id, name: p.children[0].textContent }));

  window.score = {
    name: name,
    composer: composer,
    parts: {},
  };

  parts.forEach(p => {
    var measures = toList(data.evaluate('/score-partwise/part[@id="' + p.id + '"]', data))[0].children;

    // assumes only one timing throughout

    var divisions = Number.parseInt(toList(data.evaluate('/score-partwise/part[@id="' + p.id + '"]/measure/attributes/divisions/text()', data))[0].data);

    var beats = Number.parseInt(toList(data.evaluate('/score-partwise/part[@id="' + p.id + '"]/measure/attributes/time/beats/text()', data))[0].data);

    var beatType = Number.parseInt(toList(data.evaluate('/score-partwise/part[@id="' + p.id + '"]/measure/attributes/time/beat-type/text()', data))[0].data);

    function list(xs) {
      return Array.prototype.slice.call(xs);
    }

    function nav(elt, tag) {
      return list(elt.children).filter(c => c.tagName === tag);
    }

    // TODO tempo is absent from the data, so this needs to be specified somewhere. or read from graphical markings. which then require changes to be handled

    var tempo = 120; // quarter note = 120 bpm; musescore's default

    // get notes from measures
    var notes = list(measures).map(m =>
        list(m.children)
        .filter(e => e.tagName === 'note')
        .map(n => {
          var res = {
            duration: Number.parseInt(nav(n, 'duration')[0].textContent),
          };
          var rest = nav(n, 'rest').length != 0;
          if (rest) {
            res.rest = rest;
          } else {
            var p = nav(n, 'pitch')[0];
            var note = p.children[0].textContent;
            var octave = Number.parseInt(p.children[1].textContent);
            res.pitch = { note, octave };
          }
          return res;
        })
    );

    window.score.parts[p.name] = {
      tempo: tempo,
      time: [beats, beatType],
      divisions: divisions,
      notes: notes,
    };

  });

  console.log('score loaded', score);
  resolve(score);
}
