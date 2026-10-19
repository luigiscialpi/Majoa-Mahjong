import { Text } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// Su web Skia gira su CanvasKit (WebAssembly): va caricato prima di importare i componenti che lo usano.
// Il file canvaskit.wasm si copia in public/ con `npm run setup:web`.
export default function App() {
  return (
    <WithSkiaWeb
      getComponent={() => import('./src/Main')}
      fallback={<Text style={{ color: '#fff', padding: 16 }}>Carico CanvasKit…</Text>}
      opts={{ locateFile: (file: string) => `/${file}` }}
    />
  );
}
