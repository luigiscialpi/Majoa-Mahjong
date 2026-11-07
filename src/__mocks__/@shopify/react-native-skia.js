const React = require('react');

const el = (name) => (props) => {
  const { children, ...rest } = props ?? {};
  return React.createElement(name, rest, children);
};
const elC = (name) => ({ children, ...props }) => React.createElement(name, props, children);

module.exports = {
  Canvas: elC('Canvas'),
  Group: elC('Group'),
  Image: el('Image'),
  ImageSVG: el('ImageSVG'),
  Rect: el('Rect'),
  RoundedRect: el('RoundedRect'),
  Circle: el('Circle'),
  Path: el('Path'),
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
};
