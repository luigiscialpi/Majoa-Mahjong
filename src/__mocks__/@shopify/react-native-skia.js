const React = require('react');

const el = (name) => (props) => {
  const { children, ...rest } = props ?? {};
  return React.createElement(name, rest, children);
};
const elC = (name) => ({ children, ...props }) => React.createElement(name, props, children);

// Tela finta: registra le chiamate di disegno, in modo che i test vedano cosa verrebbe disegnato (`createPicture`).
const recordingCanvas = (calls) => ({
  save: () => calls.push(['save']),
  restore: () => calls.push(['restore']),
  translate: (x, y) => calls.push(['translate', x, y]),
  scale: (x, y) => calls.push(['scale', x, y]),
  drawPath: (path, paint) =>
    calls.push(['drawPath', path.d, { color: paint.color, style: paint.style, strokeWidth: paint.strokeWidth, alpha: paint.alpha }]),
  drawPoints: (mode, points, paint) =>
    calls.push(['drawPoints', mode, points.length, { color: paint.color, strokeWidth: paint.strokeWidth, alpha: paint.alpha, cap: paint.cap }]),
});

module.exports = {
  Canvas: elC('Canvas'),
  Group: elC('Group'),
  Image: el('Image'),
  ImageSVG: el('ImageSVG'),
  Rect: el('Rect'),
  RoundedRect: el('RoundedRect'),
  Circle: el('Circle'),
  Path: el('Path'),
  Picture: el('Picture'),
  Text: el('SkiaText'),
  Shadow: el('Shadow'),
  RadialGradient: el('RadialGradient'),
  LinearGradient: el('LinearGradient'),
  vec: (x, y) => ({ x, y }),
  rect: (x, y, w, h) => ({ x, y, w, h }),
  drawAsImage: () => Promise.resolve(null),
  matchFont: () => ({
    measureText: (s) => ({ width: s.length * 8 }),
    getSize: () => 14,
  }),
  usePaint: () => ({}),
  PaintStyle: { Fill: 0, Stroke: 1 },
  PointMode: { Points: 0, Lines: 1, Polygon: 2 },
  StrokeCap: { Butt: 0, Round: 1, Square: 2 },
  createPicture: (draw, size) => {
    const calls = [];
    draw(recordingCanvas(calls));
    return { calls, size };
  },
  Skia: {
    Color: (color) => color,
    Paint: () => ({
      color: undefined,
      style: 0,
      strokeWidth: 0,
      alpha: 1,
      cap: 0,
      setAntiAlias() {},
      setColor(c) {
        this.color = c;
      },
      setStyle(v) {
        this.style = v;
      },
      setStrokeWidth(w) {
        this.strokeWidth = w;
      },
      setStrokeCap(c) {
        this.cap = c;
      },
      setAlphaf(a) {
        this.alpha = a;
      },
    }),
    Path: { MakeFromSVGString: (d) => ({ d }) },
  },
};
