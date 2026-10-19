import { Group, ImageSVG, type SkSVG } from '@shopify/react-native-skia';

/**
 * Disegna un SVG in (x, y) con dimensione (width, height).
 * Aggira un limite di React Native Skia 2.6.2: `ImageSVG` applica x e y solo se sono ENTRAMBI diversi da zero
 * (sksg/Recorder/commands/Drawing.js, `if (x && y) canvas.translate(x, y)`), quindi con x=0 o y=0
 * il disegno finisce in (0, 0). La traslazione si fa con un Group.
 */
export function SvgAt({ svg, x, y, width, height }: { svg: SkSVG | null; x: number; y: number; width: number; height: number }) {
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      <ImageSVG svg={svg} width={width} height={height} />
    </Group>
  );
}
