let OSMD = (function () {
  const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay('osmdContainer');
  window.osmd = osmd;

  osmd.setOptions({
    backend: 'svg',
    // drawTitle: false,
    drawingParameters: 'compacttight',
    renderSingleHorizontalStaffline: true,
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
    scroll();
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
