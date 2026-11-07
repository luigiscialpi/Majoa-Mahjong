const React = require('react');

module.exports = {
  Canvas: ({ children, ...props }) => React.createElement('Canvas', props, children),
  Rect: (props) => React.createElement('Rect', props),
  RadialGradient: (props) => React.createElement('RadialGradient', props),
  vec: (x, y) => ({ x, y }),
  Group: ({ children, ...props }) => React.createElement('Group', props, children),
  Image: (props) => React.createElement('Image', props),
  RoundedRect: (props) => React.createElement('RoundedRect', props),
  drawAsImage: () => null,
  matchFont: () => null,
};
