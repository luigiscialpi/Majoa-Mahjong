import { StyleSheet, Text, View } from 'react-native';

// ponytail: schermata segnaposto per avviare l'app; la sostituisce la home con la mappa delle isole.
export default function Home() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Majoa Mahjong</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  title: { fontSize: 28, fontWeight: '700', color: '#111111' },
});
