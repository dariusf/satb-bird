let OSMD = (function () {
  const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay('osmdContainer');
  window.osmd = osmd;

  osmd.setOptions({
    backend: 'svg',
    // our custom scrolling behavior seems to work better
    // followCursor: true,
    drawingParameters: 'compacttight',
    renderSingleHorizontalStaffline: true,
    // hide and follow cursor
    // cursorsOptions: [{ color: 'white', alpha: 0, follow: true }],
    cursorsOptions: [
      {
        alpha: 0.5,
        color: 'rgb(167,223,140)',
        // 'rgb(145,193,205)',
      },
    ],
  });

  async function load(xml) {
    await osmd.load(xml);
  }

  function startPart(p) {
    for (const i in osmd.sheet.Instruments) {
      osmd.sheet.Instruments[i].Visible = false;
    }
    if (typeof p === 'string') {
      osmd.sheet.Instruments.filter((p1) => p1.nameLabel.text === p).forEach((p1) => {
        p1.Visible = true;
      });
    } else if (typeof p === 'number') {
      osmd.sheet.Instruments[p].Visible = true;
    } else {
      throw 'unknown part';
    }

    // we have to rerender after changing visibility.
    // this is only called when a part is selected.
    osmd.render();
    osmd.cursor.show();
    osmd.cursor.reset();
    skipRests();
    scroll();
  }

  const scoreContainer = document.querySelector('#osmdContainer');
  function show() {
    scoreContainer.style.removeProperty('display');
  }

  function hide() {
    scoreContainer.style.display = 'none';
  }

  function next() {
    osmd.cursor.next();
    skipRests();
    scroll();
  }

  function skipRests() {
    // skip rests. this hides the rest of the score until it's time for the note, though. unfortunately we don't have anything to use to tell when rests occur, as we don't play rests or spawn pipes for them, so this is the best we can do for now
    let notes = osmd.cursor.NotesUnderCursor();
    // skip if nothing/rest, or not the first note of a tie
    while (
      notes.length === 0 ||
      (notes.length > 0 &&
        (notes[0].pitch === undefined || (notes[0].tie != undefined && notes[0].tie.notes[0] !== notes[0])))
    ) {
      osmd.cursor.next();
      notes = osmd.cursor.NotesUnderCursor();
    }
  }

  function scroll() {
    osmd.cursor.cursorElement.scrollIntoView({
      // behavior: 'smooth',
      behavior: 'auto',
      block: 'center',
      inline: 'center',
    });
  }

  return { load, next, show, hide, startPart };
})();
