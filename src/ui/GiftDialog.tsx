/**
 * Finestra regalo: overlay con mascotte (92 px), titolo, testo e 24 scintille.
 * Fedele all'originale (reference/majoa-originale/Majoa Mahjong.html):
 *   - showGift riga 2480: mascotte o 🎁, titolo, testo, pulsante «ok»
 *   - sparkBurst riga 2082: 24 particelle (✨⭐💛) a distanza 150 px, 600-950 ms, ease-out
 * Usata dalla mappa per le isole scoperte e dall'album per le carte.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { MascotMedallion } from './MascotMedallion';
import { useMascotUri } from './mascots';
import { useSettings } from './SettingsProvider';
import { getSoundService } from '../infrastructure/audio/soundService';
import { useTranslation } from '../infrastructure/i18n';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';

/** Particella di scintilla animata. */
type Particle = {
  id: number;
  glyph: string;
  angle: number;
  dist: number;
  duration: number;
  delay: number;
};

const GLYPHS = ['✨', '⭐', '💛'] as const;
const PARTICLE_COUNT = 24;
const BURST_DIST = 150;

function buildParticles(): Particle[] {
  // ponytail: seed deterministico per evitare Math.random() – valori precalcolati fedeli all'originale
  // (non serve PRNG in un componente UI: è solo visivo, non affecta il dominio)
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    glyph: GLYPHS[i % GLYPHS.length],
    angle: (i / PARTICLE_COUNT) * Math.PI * 2 + (i % 3) * 0.4,
    dist: (0.5 + (i % 7) / 7 * 0.7) * BURST_DIST,
    duration: 600 + (i % 5) * 70,
    delay: (i % 4) * 40,
  }));
}

const PARTICLES = buildParticles();

function Particle({ p }: { p: Particle }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: p.duration,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, p.delay);
    return () => clearTimeout(timer);
  }, [anim, p.duration, p.delay]);

  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.dist] });
  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(p.angle) * p.dist - 18] });
  const scale = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.15, 1.15] });
  const opacity = anim.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.Text
      style={[styles.particle, { transform: [{ translateX: tx }, { translateY: ty }, { scale }], opacity }]}
      accessibilityElementsHidden
    >
      {p.glyph}
    </Animated.Text>
  );
}

export type GiftDialogProps = {
  /** Titolo della finestra (es. «Nuova isola scoperta!»). */
  title: string;
  /** Corpo del messaggio (es. «L'Isola degli animali è aperta. +3 monete»). */
  body: string;
  /** Callback quando il giocatore chiude la finestra. */
  onClose: () => void;
  /** testID per i test. */
  testID?: string;
};

/**
 * Finestra regalo: appare quando si scopre un'isola o si guadagna una carta album.
 * Suona `win` e lancia 24 scintille all'apertura (come l'originale).
 */
export function GiftDialog({ title, body, onClose, testID }: GiftDialogProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const mascotUri = useMascotUri(settings.mascot);

  useEffect(() => {
    getSoundService().play('win');
  }, []);

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.scrim} testID={testID}>
        {/* Scintille: layer sopra tutto, centrate sul medaglione */}
        <View style={styles.burstAnchor} pointerEvents="none">
          {PARTICLES.map((p) => (
            <Particle key={p.id} p={p} />
          ))}
        </View>

        <View style={styles.card} accessibilityViewIsModal>
          {/* Mascotte o 🎁 */}
          <View style={styles.iconRow}>
            {mascotUri ? (
              <MascotMedallion uri={mascotUri} size={92} testID="gift-mascot" />
            ) : (
              <Text style={styles.giftEmoji} accessibilityLabel="regalo">
                🎁
              </Text>
            )}
          </View>

          <Text style={styles.title} accessibilityRole="header" testID="gift-title">
            {title}
          </Text>
          <Text style={styles.body} testID="gift-body">
            {body}
          </Text>

          <Button
            label={t('giftOk')}
            onPress={onClose}
            kind="primary"
            testID="gift-ok"
          />
        </View>
      </View>
    </Modal>
  );
}

const CARD_MAX = 380;

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(5,15,12,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  burstAnchor: {
    position: 'absolute',
    // Centrato verticalmente a ~33% dello schermo (fedele all'originale: `window.innerHeight * 0.33`)
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    fontSize: Platform.OS === 'android' ? 20 : 18,
    // pointerEvents none ereditato dal padre
  },
  card: {
    width: '100%',
    maxWidth: CARD_MAX,
    borderRadius: 20,
    backgroundColor: colors.feltB,
    borderWidth: 2,
    borderColor: colors.accent,
    padding: 24,
    gap: 14,
    alignItems: 'center',
  },
  iconRow: {
    marginBottom: 4,
  },
  giftEmoji: {
    fontSize: 72,
    lineHeight: 92,
    textAlign: 'center',
  },
  title: {
    color: colors.accent,
    fontSize: 22,
    fontFamily: fontFamilies.title,
    textAlign: 'center',
  },
  body: {
    color: colors.inkSoft,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fontFamilies.body,
    textAlign: 'center',
  },
});
