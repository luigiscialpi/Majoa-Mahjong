// Esporta tutti gli effetti sonori sintetizzati di Majoa Mahjong in campioni WAV (16-bit PCM, 44.1 kHz).
// Uso: node tools/export-sounds.js [cartella_destinazione]
// Esegue un rendering deterministico tramite OfflineAudioContext in Chromium headless.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const targetDir = process.argv[2] 
  ? path.resolve(process.argv[2]) 
  : path.resolve(__dirname, '../assets/sounds');

const CHROME_PATH = process.env.CHROME_BIN || 
  (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : 'chromium');

const HTML_RUNNER = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Audio Exporter</title></head>
<body>
<script>
(async () => {
  const SAMPLE_RATE = 44100;
  const ROOTS = [261.6, 293.7, 329.6, 349.2, 392, 440, 493.9, 523.3, 587.3, 659.3, 277.2, 311.1, 370, 415.3, 466.2, 554.4, 622.3, 698.5, 784, 830.6];
  const SCALE = [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25, 2.5];
  const root = () => ROOTS[0]; // Livello 1: 261.6 Hz (Do4)

  // Generatore pseudocasuale deterministico per il buffer di rumore
  function pseudoRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function createNoiseBuffer(ctx, seed = 12345) {
    const prng = pseudoRandom(seed);
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = prng() * 2 - 1;
    }
    return nb;
  }

  function renderEffect(durationSec, buildFn) {
    const ctx = new OfflineAudioContext(1, Math.ceil(SAMPLE_RATE * durationSec), SAMPLE_RATE);
    const noiseBuffer = createNoiseBuffer(ctx);

    function tone(f, t0, dur, type, vol, to) {
      if (!isFinite(f) || f <= 0) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = t0;
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t);
      if (to && isFinite(to) && to > 0) {
        o.frequency.exponentialRampToValueAtTime(to, t + dur);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, (vol || 0.15)), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    function noise(t0, dur, vol, type, freq) {
      const s = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      const t = t0;
      s.buffer = noiseBuffer;
      f.type = type;
      f.frequency.value = freq;
      g.gain.setValueAtTime(Math.max(0.0003, vol), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      s.start(t);
      s.stop(t + Math.min(dur + 0.05, 0.95));
    }

    buildFn({ tone, noise, root: root(), SCALE });
    return ctx.startRendering();
  }

  function audioBufferToWavBase64(buffer) {
    const numChannels = 1;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;
    const channelData = buffer.getChannelData(0);
    const numSamples = buffer.length;
    const blockAlign = numChannels * (bitDepth / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);

    function writeStr(offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      let s = Math.max(-1, Math.min(1, channelData[i]));
      let intSample = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }

    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  const SOUND_DEFS = {
    // 8 note della scala combo
    'match_0': { dur: 0.55, build: ({tone, root, SCALE}) => {
      const f = root * SCALE[0];
      tone(f, 0, .2, 'sine', .2); tone(f * 1.5, .07, .26, 'triangle', .14); tone(f * 2, .14, .3, 'sine', .09);
    }},
    'match_1': { dur: 0.55, build: ({tone, root, SCALE}) => {
      const f = root * SCALE[1];
      tone(f, 0, .2, 'sine', .2); tone(f * 1.5, .07, .26, 'triangle', .14); tone(f * 2, .14, .3, 'sine', .09);
    }},
    'match_2': { dur: 0.55, build: ({tone, root, SCALE}) => {
      const f = root * SCALE[2];
      tone(f, 0, .2, 'sine', .2); tone(f * 1.5, .07, .26, 'triangle', .14); tone(f * 2, .14, .3, 'sine', .09);
    }},
    'match_3': { dur: 0.55, build: ({tone, root, SCALE}) => {
      const f = root * SCALE[3];
      tone(f, 0, .2, 'sine', .2); tone(f * 1.5, .07, .26, 'triangle', .14); tone(f * 2, .14, .3, 'sine', .09);
    }},
    'match_4': { dur: 0.55, build: ({tone, root, SCALE}) => {
      const f = root * SCALE[4];
      tone(f, 0, .2, 'sine', .2); tone(f * 1.5, .07, .26, 'triangle', .14); tone(f * 2, .14, .3, 'sine', .09);
    }},
    'match_5': { dur: 0.55, build: ({tone, root, SCALE}) => {
      const f = root * SCALE[5];
      tone(f, 0, .2, 'sine', .2); tone(f * 1.5, .07, .26, 'triangle', .14); tone(f * 2, .14, .3, 'sine', .09);
    }},
    'match_6': { dur: 0.55, build: ({tone, root, SCALE}) => {
      const f = root * SCALE[6];
      tone(f, 0, .2, 'sine', .2); tone(f * 1.5, .07, .26, 'triangle', .14); tone(f * 2, .14, .3, 'sine', .09);
    }},
    'match_7': { dur: 0.55, build: ({tone, root, SCALE}) => {
      const f = root * SCALE[7];
      tone(f, 0, .2, 'sine', .2); tone(f * 1.5, .07, .26, 'triangle', .14); tone(f * 2, .14, .3, 'sine', .09);
    }},

    // Altri effetti
    'select': { dur: 0.2, build: ({tone, root}) => {
      tone(root * 2, 0, .09, 'triangle', .12);
    }},
    'blocked': { dur: 0.25, build: ({tone}) => {
      tone(130, 0, .14, 'square', .06, 85);
    }},
    'hint': { dur: 0.45, build: ({tone, root}) => {
      tone(root * 3, 0, .12, 'sine', .14);
      tone(root * 4, .1, .22, 'sine', .14);
    }},
    'undo': { dur: 0.25, build: ({tone, root}) => {
      tone(root * 2, 0, .14, 'triangle', .12, root);
    }},
    'shuffle': { dur: 0.55, build: ({tone, noise}) => {
      noise(0, .4, .14, 'bandpass', 1200);
      tone(180, 0, .4, 'sawtooth', .04, 900);
    }},
    'stuck': { dur: 0.65, build: ({tone}) => {
      tone(330, 0, .18, 'triangle', .13);
      tone(247, .18, .32, 'triangle', .13);
    }},
    'start': { dur: 0.55, build: ({tone, root}) => {
      tone(root, 0, .12, 'triangle', .13);
      tone(root * 1.25, .1, .12, 'triangle', .13);
      tone(root * 1.5, .2, .2, 'triangle', .13);
    }},
    'star_0': { dur: 0.45, build: ({tone, root}) => {
      tone(root * 2 * (1 + 0 * .25), 0, .3, 'sine', .18);
      tone(root * 4 * (1 + 0 * .25), .05, .25, 'triangle', .08);
    }},
    'star_1': { dur: 0.45, build: ({tone, root}) => {
      tone(root * 2 * (1 + 1 * .25), 0, .3, 'sine', .18);
      tone(root * 4 * (1 + 1 * .25), .05, .25, 'triangle', .08);
    }},
    'star_2': { dur: 0.45, build: ({tone, root}) => {
      tone(root * 2 * (1 + 2 * .25), 0, .3, 'sine', .18);
      tone(root * 4 * (1 + 2 * .25), .05, .25, 'triangle', .08);
    }},
    'win': { dur: 1.7, build: ({tone, root}) => {
      const a = [1, 1.25, 1.5, 2, 2.5, 3];
      for (let i = 0; i < a.length; i++) tone(root * a[i], i * .11, .35, 'triangle', .16);
      tone(root * 2, a.length * .11, .9, 'sine', .14);
      tone(root * 2.5, a.length * .11, .9, 'sine', .12);
      tone(root * 3, a.length * .11, .9, 'sine', .12);
    }},
    'boom': { dur: 0.7, build: ({tone, noise}) => {
      noise(0, .55, .2, 'lowpass', 500);
      noise(.03, .25, .1, 'highpass', 3500);
      tone(90, 0, .3, 'sine', .12, 40);
    }},
    'fog': { dur: 0.5, build: ({tone, noise, root}) => {
      noise(0, .35, .06, 'bandpass', 900);
      tone(root * 2, .02, .25, 'sine', .06);
    }},
    'gold': { dur: 0.65, build: ({tone, root}) => {
      const a = [3, 4, 5, 6.5, 8];
      for (let i = 0; i < a.length; i++) tone(root * a[i], i * .055, .28, 'sine', .13);
    }},
    'unlock': { dur: 0.75, build: ({tone, noise, root}) => {
      const a = [2, 2.5, 3, 4, 5];
      for (let i = 0; i < a.length; i++) tone(root * a[i], .05 + i * .07, .3, 'sine', .13);
      noise(0, .25, .08, 'highpass', 5000);
    }},
    'pop': { dur: 0.25, build: ({noise}) => {
      noise(0, .12, .07, 'highpass', 4500);
    }}
  };

  const results = {};
  for (const [name, def] of Object.entries(SOUND_DEFS)) {
    const rendered = await renderEffect(def.dur, def.build);
    results[name + '.wav'] = audioBufferToWavBase64(rendered);
  }

  await fetch('/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(results)
  });
})();
</script>
</body>
</html>`;

(async () => {
  fs.mkdirSync(targetDir, { recursive: true });

  const server = http.createServer((req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(HTML_RUNNER);
    } else if (req.method === 'POST' && req.url === '/save') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const files = JSON.parse(body);
        let count = 0;
        for (const [filename, base64] of Object.entries(files)) {
          const buf = Buffer.from(base64, 'base64');
          fs.writeFileSync(path.join(targetDir, filename), buf);
          count++;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, count }));
        console.log(`Esportati ${count} campioni WAV in: ${targetDir}`);
        if (chrome) chrome.kill();
        server.close();
      });
    }
  });

  let chrome = null;
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    chrome = spawn(CHROME_PATH, [
      '--headless=new',
      '--disable-gpu',
      `http://127.0.0.1:${port}`
    ]);
    chrome.on('error', err => {
      console.error('Errore avvio Chromium:', err.message);
      process.exit(1);
    });
  });
})();
