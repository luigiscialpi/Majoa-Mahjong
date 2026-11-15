import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { MascotMedallion, MEDALLION_COLOR } from './MascotMedallion';

// Il medaglione si confronta con la regola CSS dell'originale (`.cmbox .mcv`, riga 271), non con valori scritti a occhio.
const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const css = /\.cmbox \.mcv\{width:(\d+)px;height:(\d+)px;border-radius:(\d+)%;background:(#\w+)/.exec(fs.readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8'))!;
const HIDDEN = { includeHiddenElements: true };

describe('MascotMedallion', () => {
  test('tondo, crema e della misura data, come `.cmbox .mcv`', async () => {
    expect(MEDALLION_COLOR).toBe(css[4]);
    expect(css[3]).toBe('50');
    await render(<MascotMedallion uri="data:image/png;base64,QUJD" size={Number(css[1])} />);
    const style = StyleSheet.flatten(screen.getByTestId('mascot-medallion', HIDDEN).props.style);
    expect(style).toMatchObject({ width: 58, height: 58, borderRadius: 29, backgroundColor: css[4], overflow: 'hidden' });
  });

  test('con altre misure resta tondo (raggio = metà)', async () => {
    await render(<MascotMedallion uri="data:image/png;base64,QUJD" size={92} />);
    expect(StyleSheet.flatten(screen.getByTestId('mascot-medallion', HIDDEN).props.style)).toMatchObject({ width: 92, height: 92, borderRadius: 46 });
  });

  test('mostra l\'immagine intera nel riquadro e non è letto dai lettori di schermo', async () => {
    await render(<MascotMedallion uri="data:image/png;base64,QUJD" size={58} />);
    const wrap = screen.getByTestId('mascot-medallion', HIDDEN);
    expect(wrap.props.importantForAccessibility).toBe('no-hide-descendants');
    const img = wrap.children[0] as unknown as { props: { source: { uri: string }; resizeMode: string; style: { width: number; height: number } } };
    expect(img.props.source).toEqual({ uri: 'data:image/png;base64,QUJD' });
    expect(img.props.resizeMode).toBe('contain'); // come `preserveAspectRatio` di un <svg> quadrato: tutta la figura, centrata
    expect(img.props.style).toEqual({ width: 58, height: 58 });
  });
});
