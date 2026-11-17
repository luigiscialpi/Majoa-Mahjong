import { StyleSheet, Text, View } from 'react-native';
import type { SkSVG } from '@shopify/react-native-skia';
import { locale, useTranslation } from '../infrastructure/i18n';
import type { Palette } from '../infrastructure/content/legacyThemes';
import { AppIcon } from './AppIcon';
import { MINI_FACE, MINI_RECENT, MiniTile } from './miniTiles';
import { BAR_RECENT, barName, type BarStatus, type BarView } from './selectionBar';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';

// Misure e colori di `#selbar`, `.sbslot`, `.sbstat`, `.sbname` e `.sbrec` (righe 192-200 dell'originale).
export const BAR_MIN_HEIGHT = 60;
const STATUS_OK = '#7dff9a';
const STATUS_BAD = '#ff8a8a';
const STATUS_PLAIN = '#fff';
const STATUS_BLOCKED = '#e5484d';

export type SelectionBarProps = {
  view: BarView;
  /** Disegni degli ultimi abbinamenti, dal più vecchio; se ne mostrano gli ultimi `BAR_RECENT`. */
  recent: readonly number[];
  /** Tessere per gruppo: 3 nei livelli Tris (terza casella). */
  groupSize: number;
  svgs: readonly (SkSVG | null)[];
  palette: Palette;
};

/**
 * Barra delle tessere selezionate (opzionale): le tessere toccate ingrandite, un segno per l'esito, il loro nome e gli
 * ultimi abbinamenti. Annuncia il nome ai lettori di schermo (`aria-live="polite"` nell'originale). Il segno non usa font
 * né emoji: sono forme, e la forma distingue gli esiti anche senza il colore.
 */
export function SelectionBar({ view, recent, groupSize, svgs, palette }: SelectionBarProps) {
  const { lang, t } = useTranslation();
  const name = barName(view.slots, locale(lang).tn, t('tnHidden'), t('tnFog'));
  const slotCount = groupSize === 3 ? 3 : 2;
  const cells = Array.from({ length: slotCount }, (_, i) => view.slots[i]); // la seconda casella sta dopo il segno (`sb1`, `sbStat`, `sb2`, `sb3`)
  return (
    <View style={styles.bar} accessibilityLiveRegion="polite" testID="selection-bar">
      <View style={styles.slots}>
        <Slot slot={cells[0]} index={0} svgs={svgs} palette={palette} />
        <View style={styles.status} testID="selection-bar-status" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {view.status ? <StatusMark status={view.status} /> : null}
        </View>
        {cells.slice(1).map((slot, i) => (
          <Slot key={i + 1} slot={slot} index={i + 1} svgs={svgs} palette={palette} />
        ))}
      </View>
      <Text style={styles.name} numberOfLines={1} testID="selection-bar-name">
        {name}
      </Text>
      <View style={styles.recent} testID="selection-bar-recent">
        {recent.slice(-BAR_RECENT).map((design, i) => (
          <MiniTile key={i} slot={design} svgs={svgs} palette={palette} width={MINI_RECENT.w} height={MINI_RECENT.h} />
        ))}
      </View>
    </View>
  );
}

function Slot({ slot, index, svgs, palette }: { slot: BarView['slots'][number] | undefined; index: number; svgs: SelectionBarProps['svgs']; palette: Palette }) {
  if (slot === undefined) return <View style={styles.empty} testID={`selection-bar-slot-${index}`} />;
  return <MiniTile slot={slot} svgs={svgs} palette={palette} width={MINI_FACE.w} height={MINI_FACE.h} testID={`selection-bar-slot-${index}`} />;
}

/** ✔ ✖ 🔒 ⛔ dell'originale, come forme: segno di spunta, croce, lucchetto e divieto. */
function StatusMark({ status }: { status: Exclude<BarStatus, null> }) {
  if (status === 'ok') return <View style={styles.check} testID="status-ok" />;
  if (status === 'bad') {
    return (
      <View style={styles.cross} testID="status-bad">
        <View style={[styles.crossBar, { transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.crossBar, { transform: [{ rotate: '-45deg' }] }]} />
      </View>
    );
  }
  if (status === 'locked') return <AppIcon name="lock" size={20} color={STATUS_PLAIN} />;
  return (
    <View style={styles.noEntry} testID="status-blocked">
      <View style={styles.noEntryBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 2, paddingBottom: 4, paddingHorizontal: 12, minHeight: BAR_MIN_HEIGHT },
  slots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { width: MINI_FACE.w, height: MINI_FACE.h, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)', borderRadius: MINI_FACE.radius },
  status: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, minWidth: 0, fontFamily: fontFamilies.bodyBold, fontSize: 15, color: colors.ink },
  recent: { flexDirection: 'row', gap: 4 },
  check: { width: 9, height: 16, marginTop: -3, borderRightWidth: 3.5, borderBottomWidth: 3.5, borderColor: STATUS_OK, transform: [{ rotate: '45deg' }] },
  cross: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  crossBar: { position: 'absolute', width: 20, height: 3.5, borderRadius: 2, backgroundColor: STATUS_BAD },
  noEntry: { width: 20, height: 20, borderRadius: 10, backgroundColor: STATUS_BLOCKED, alignItems: 'center', justifyContent: 'center' },
  noEntryBar: { width: 12, height: 3.5, borderRadius: 2, backgroundColor: '#fff' },
});
