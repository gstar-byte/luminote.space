import 'react-native-gesture-handler';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import IdeaCapsuleApp from './src/IdeaCapsuleApp';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.root, Platform.OS === 'web' && styles.rootWeb]}>
        <SafeAreaProvider style={styles.fill}>
          <IdeaCapsuleApp />
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  /** Expo Web：占满视口，便于浏览器里尺寸与真机接近 */
  rootWeb: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
  },
  fill: { flex: 1 },
});
