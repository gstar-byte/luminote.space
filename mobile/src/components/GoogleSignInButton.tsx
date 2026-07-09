import React, { useEffect, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { auth, supabase } from '../lib/supabaseMobile';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  /** Light-outline button on dark landing; light variant for auth form. */
  variant?: 'dark' | 'light';
  compact?: boolean;
};

function GoogleIcon() {
  return (
    <View style={styles.gWrap}>
      <Text style={styles.gLetter}>G</Text>
    </View>
  );
}

/** Shown when EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing. */
export function GoogleSignInPlaceholder({
  variant = 'light',
  compact,
}: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        variant === 'dark' ? styles.btnDark : styles.btnLight,
        compact && styles.btnCompact,
      ]}
      onPress={() =>
        Alert.alert(
          'Configure Google sign-in',
          'Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env (Firebase Console → Project settings → Your apps → Web client ID).\n\nFor Android with Expo Go, add the debug SHA-1 to your OAuth client in Google Cloud (see docs/PR-LANDING-PREMIUM-PARITY.md).',
        )
      }
    >
      <GoogleIcon />
      <Text style={[styles.label, variant === 'dark' && styles.labelDark]}>
        Google
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Renders only when Web client ID is set (required for hooks rules).
 */
function GoogleSignInConfigured({
  webClientId,
  iosClientId,
  androidClientId,
  variant = 'light',
  compact,
}: Props & {
  webClientId: string;
  iosClientId?: string;
  androidClientId?: string;
}) {
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId,
    iosClientId: iosClientId || undefined,
    androidClientId: androidClientId || undefined,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'cancel' || response.type === 'dismiss') return;
    if (response.type === 'error') {
      const err = (response as { error?: { message?: string } }).error;
      Alert.alert('Google sign-in failed', err?.message ?? 'Please try again.');
      return;
    }
    if (response.type !== 'success') return;
    const idToken = response.params.id_token;
    if (!idToken) {
      Alert.alert(
        'Google sign-in',
        'No id_token returned. Check that your Web client ID matches Firebase.',
      );
      return;
    }
    (async () => {
      try {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });
        if (error) throw error;
      } catch (e) {
        console.error(e);
        Alert.alert('Google sign-in failed', e instanceof Error ? e.message : String(e));
      }
    })();
  }, [response]);

  const onPress = useCallback(async () => {
    setBusy(true);
    try {
      await promptAsync();
    } catch (e) {
      console.error(e);
      Alert.alert('Google sign-in', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [promptAsync]);

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        variant === 'dark' ? styles.btnDark : styles.btnLight,
        compact && styles.btnCompact,
      ]}
      disabled={!request || busy}
      onPress={onPress}
    >
      {busy ? (
        <ActivityIndicator />
      ) : (
        <>
          <GoogleIcon />
          <Text style={[styles.label, variant === 'dark' && styles.labelDark]}>
            Google
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function GoogleSignInButton(props: Props) {
  const extra = Constants.expoConfig?.extra as
    | {
        googleWebClientId?: string;
        googleIosClientId?: string;
        googleAndroidClientId?: string;
      }
    | undefined;

  const web = extra?.googleWebClientId?.trim() ?? '';
  if (!web) {
    return <GoogleSignInPlaceholder {...props} />;
  }

  return (
    <GoogleSignInConfigured
      {...props}
      webClientId={web}
      iosClientId={extra?.googleIosClientId?.trim()}
      androidClientId={extra?.googleAndroidClientId?.trim()}
    />
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    minWidth: 140,
  },
  btnCompact: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 0,
  },
  btnLight: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  btnDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  label: {
    fontWeight: '800',
    fontSize: 16,
    color: '#1D1D1F',
  },
  labelDark: { color: '#FFF' },
  gWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gLetter: { fontWeight: '900', fontSize: 13, color: '#4285F4' },
});
