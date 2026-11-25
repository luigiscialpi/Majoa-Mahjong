import { SettingsScreen } from '../../ui/SettingsScreen';
import { TabScreen } from '../../ui/TabScreen';

export default function SettingsRoute() {
  return (
    <TabScreen>
      <SettingsScreen />
    </TabScreen>
  );
}
