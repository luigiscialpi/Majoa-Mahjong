import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';
import { useTranslation } from '../../infrastructure/i18n';
import { colors } from '../../ui/theme/colors';
import { fontFamilies } from '../../ui/theme/typography';

/** Barra di navigazione in basso: Mappa, Giochi e Impostazioni. La partita (`play`) e il rompicapo (`puzzle`) stanno fuori dalla barra, a tutto schermo. */
export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: { fontFamily: fontFamilies.bodyBold, fontSize: 12 },
        tabBarStyle: { backgroundColor: colors.feltB, borderTopColor: 'rgba(255,255,255,0.12)' },
        sceneStyle: { backgroundColor: colors.feltB },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabMap'), tabBarButtonTestID: 'tab-map', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🗺️</Text> }} />
      <Tabs.Screen name="games" options={{ title: t('tabGames'), tabBarButtonTestID: 'tab-games', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🧩</Text> }} />
      <Tabs.Screen name="settings" options={{ title: t('tabSettings'), tabBarButtonTestID: 'tab-settings', tabBarIcon: () => <Text style={{ fontSize: 20 }}>⚙️</Text> }} />
    </Tabs>
  );
}
