const VP = window.picker, $ = id => document.getElementById(id);
let cfg = { ...ANN.DEFAULT };

function button(label, on, click, extra = ''){
  const b = document.createElement('button'); b.innerHTML = label + extra; if (on) b.className = 'on';
  b.onclick = () => { click(); render(); play(); }; return b;
}
function render(){
  ANN.set(cfg);
  const vs = ANN.voices(), cur = ANN.findVoice();
  const sorted = [...vs].sort((a, b) => (/^en/i.test(b.lang) - /^en/i.test(a.lang)) || a.name.localeCompare(b.name)).slice(0, 14);
  $('voices').replaceChildren(...(sorted.length ? sorted.map(v => button(`▶ ${ANN.shortName(v).split(' · ')[0]}`, cur && v.name === cur.name, () => cfg.voice = v.name,
    ` <small>${v.lang}</small>`)) : [Object.assign(document.createElement('div'), { textContent: 'Loading voices…' })]));
  $('styles').replaceChildren(...Object.entries(ANN.STYLES).map(([k, s]) => button(s.label, cfg.style === k, () => cfg.style = k)));
  $('chimes').replaceChildren(...Object.entries(ANN.CHIMES).map(([k, c]) => button(c.label, cfg.chime === k, () => cfg.chime = k)));
  $('opener').checked = cfg.opener;
}
function play(){
  ANN.set(cfg); document.body.classList.add('playing'); $('saved').textContent = '';
  ANN.say($('sample').value, 'happy', { announce: true, force: true, onend: () => document.body.classList.remove('playing') });
}
$('opener').onchange = e => { cfg.opener = e.target.checked; play(); };
$('play').onclick = play;
$('keep').onclick = () => {
  if (!cfg.voice) cfg.voice = ANN.findVoice()?.name || '';
  VP.save({ ...cfg, picked: true }); $('saved').textContent = '✓ Saved! I\'ll use this voice from now on.';
  ANN.stop(); ANN.say('Thank you. This is your new announcement voice.', 'happy', { announce: false, onend: () => setTimeout(() => VP.close(), 400) }); setTimeout(() => VP.close(), 6000);
};
window.addEventListener('ann-voices', render);
VP.get().then(c => { if (c) cfg = { ...cfg, ...c }; render(); });
setTimeout(render, 600);
