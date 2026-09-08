async function cycleChecks() {
  // Run the source and bundle in a real browser, like flight-checks.js.
  const checks = [], worlds = [];
  const assert = (value, name) => { if (!value) throw new Error(name); checks.push(name); };
  const near = (a, b, tolerance = 1e-7) => Math.abs(a - b) < tolerance;
  const wrap = (v) => ((v % 1) + 1) % 1;
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  async function open() {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
    frame.src = location.href;
    document.body.append(frame);
    worlds.push(frame);
    const win = frame.contentWindow, deadline = Date.now() + 90000;
    while (!win.__fly?.ready && !win.flightFailed && Date.now() < deadline) await wait(50);
    if (!win.__fly?.ready) throw new Error('cycle test world did not open');
    return { win, doc: win.document, z: win.__fly, frame };
  }
  async function close(world) { await world.z.dispose(); world.frame.remove(); }
  await window.__fly?.dispose();
  localStorage.clear();
  try {
    const world = await open(), { win, doc, z } = world;
    const button = (field, value) => doc.querySelector(`[data-cycle="${field}"][data-value="${value}"]`).click();
    const input = (id, value, type = 'input') => {
      const field = doc.getElementById(id);
      field.value = String(value);
      field.dispatchEvent(new win.Event(type, { bubbles: true }));
    };
    z.begin();
    if (!z.paused) doc.getElementById('pauseBtn').click();
    doc.getElementById('cycleControls').open = true;
    input('daySpeedPreset', 0, 'change');
    input('seasonSpeedPreset', 0, 'change');
    for (const [hour, expected] of [[6, '06:00'], [12, '12:00'], [18, '18:00'], [0, '00:00']]) {
      input('timeOfDay', hour);
      assert(near(z.environment.timeOfDay, hour), `time slider sets ${expected} on the local civil clock`);
      assert(doc.getElementById('timeValue').value === expected, `time output shows ${expected}`);
    }
    for (const name of ['sunrise', 'noon', 'sunset', 'midnight']) {
      doc.querySelector(`[data-time-preset="${name}"]`).click();
      const day = z.astronomy, utc = name === 'midnight' ? day.start : day[name];
      assert(near(z.dayPhase, (utc - day.start) / (day.end - day.start)), `${name} preset selects the actual local event`);
    }
    input('timeOfDay', 15.5);
    assert(near(z.environment.timeOfDay, 15.5) && doc.getElementById('timeValue').value === '15:30', 'continuous time slider sets a custom hour');
    input('timeOfDay', 24);
    assert(near(z.dayPhase, 0), '24:00 wraps to midnight');
    input('seasonOfYear', 3.5);
    assert(near(z.seasonPhase, 0.875) && doc.getElementById('seasonValue').value.includes('Winter → Spring'), 'continuous season slider blends across year end');
    input('seasonOfYear', 4);
    assert(z.seasonPhase === 0, 'end of year wraps to spring');
    const t = z.state.t, heading = z.state.heading;
    doc.getElementById('daySpeedPreset').dispatchEvent(new win.KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true}));
    doc.querySelector('#cycleControls summary').dispatchEvent(new win.KeyboardEvent('keydown', {code:'Space', bubbles:true}));
    assert(z.paused && z.state.heading === heading && !z.state.nudgeAlt, 'select and summary keyboard input does not steer or unpause');
    const start = { day: z.dayPhase, season: z.seasonPhase };
    await wait(350);
    assert(z.state.t === t && z.dayPhase === start.day && z.seasonPhase === start.season, 'paused edits preview without advancing the flight or clocks');
    const frames = z.perf.frames;
    await wait(250);
    assert(z.perf.frames === frames, 'paused preview settles without an idle render loop');
    const stepSecond = () => { for (let i = 0; i < 20; i++) z.step(0.05); };
    stepSecond();
    assert(z.dayPhase === start.day && z.seasonPhase === start.season, 'both frozen cycles stay frozen while flight advances');
    input('daySpeed', 4);
    input('timeOfDay', 12);
    button('seasonOfYear', 2);
    assert(z.cycleSpeeds.day === 4 && z.cycleSpeeds.season === 0, 'time and season presets preserve independent speeds');
    stepSecond();
    assert(near(z.dayPhase, 0.5 + 4 / 600) && z.seasonPhase === 0.5 && z.dayRate === 1, 'day advances at chosen rate with season frozen and no opening stretch');
    const beforeRateChange = z.dayPhase;
    input('daySpeed', 12);
    assert(z.dayPhase === beforeRateChange, 'changing speed never jumps the time');
    input('seasonSpeed', 60);
    input('seasonOfYear', 3.99);
    const beforeWrap = z.seasonPhase;
    stepSecond();
    assert(near(z.dayPhase, beforeRateChange + 12 / 600) && near(z.seasonPhase, wrap(beforeWrap + 60 / 2400)), 'both rates run together and seasons wrap continuously');
    input('daySpeed', 0);
    const frozenDay = z.dayPhase, movingSeason = z.seasonPhase;
    stepSecond();
    assert(z.dayPhase === frozenDay && near(z.seasonPhase, movingSeason + 60 / 2400), 'season continues with day frozen');
    input('seasonSpeed', 0);
    input('timeOfDay', 12);
    const captures = [];
    for (const season of [1, 0, 2, 3]) {
      button('seasonOfYear', season);
      await wait(150); // allow the scheduled paused preview to finish before readback
      captures.push(await z.capture(128, 72));
      assert(near(z.seasonPhase, season / 4), `season preset sets quarter ${season}`);
    }
    const delta = (a, b) => {
      let sum = 0;
      for (let i = a.data.length / 2; i < a.data.length; i += 4)
        for (let c = 0; c < 3; c++) sum += Math.abs(a.data[i+c] - b.data[i+c]);
      return sum / (a.data.length / 2 * 0.75);
    };
    const seasonalDifferences = captures.slice(1).map(image => delta(captures[0], image));
    assert(seasonalDifferences.every(difference => difference > 0.0001), 'spring, autumn and winter visibly differ from summer at the same place and hour');
    input('timeOfDay', 0);
    await wait(150);
    const night = await z.capture(128, 72);
    assert(delta(captures[3], night) > 0.001, 'winter also responds to day/night lighting');
    assert(!win.flightFailed, 'all seasonal surfaces render without a graphics failure');
    input('daySpeed', 2.75);
    input('seasonSpeed', 0);
    input('timeOfDay', 20.5);
    input('seasonOfYear', 2.4);
    assert(doc.getElementById('daySpeedPreset').value === '', 'custom speed is represented without selecting an incorrect preset');
    const saved = { hour: z.environment.timeOfDay };
    await close(world);
    const again = await open();
    assert(again.z.resumed && near(again.z.environment.timeOfDay, saved.hour) && again.z.environment.date === '2004-08-21', 'resume restores local hour and opens on the default date');
    assert(again.z.cycleSpeeds.day === 2.75 && again.z.cycleSpeeds.season === 0, 'reload preserves a custom speed and a frozen cycle');
    await close(again);
    const legacy = JSON.parse(localStorage.getItem('fly-with-me-resume'));
    delete legacy.seasonPhase;
    localStorage.setItem('fly-with-me-resume', JSON.stringify(legacy));
    localStorage.setItem('fly-with-me-settings', JSON.stringify({daySpeed: -10, seasonSpeed: 'bad'}));
    const old = await open();
    assert(old.z.resumed && old.z.environment.date === '2004-08-21', 'older saves also open on the default date');
    assert(old.z.cycleSpeeds.day === 1 && old.z.cycleSpeeds.season === 1, 'invalid stored rates safely use defaults');
    await close(old);
    return { checks, seasonalDifferences };
  } finally {
    for (const frame of worlds) {
      if (frame.isConnected) { await frame.contentWindow.__fly?.dispose(); frame.remove(); }
    }
    localStorage.clear();
  }
}
