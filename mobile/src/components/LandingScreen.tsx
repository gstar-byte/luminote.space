import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Sparkles } from 'lucide-react-native';
import { GoogleSignInButton } from './GoogleSignInButton';

type Props = {
  onEmailAuth: () => void;
  onGuestPress?: () => void;
};

/** Aligned with PC Web LandingPage — brand "Lumi Note", no Facebook */
export function LandingScreen({ onEmailAuth, onGuestPress }: Props) {
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMsg, setContactMsg] = useState('');

  const sendDemo = () => {
    Alert.alert('Message sent (demo)!', 'Same demo behavior as the web landing page.');
    setContactName('');
    setContactEmail('');
    setContactMsg('');
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0A0A0A', '#12121a', '#0A0A0A']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.nav}>
            <Text style={styles.brand}>Lumi Note</Text>
            <View style={styles.navActions}>
              <TouchableOpacity onPress={onEmailAuth}>
                <Text style={styles.navLink}>Log in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navCta} onPress={onEmailAuth}>
                <Text style={styles.navCtaTxt}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroGlow}>
            <LinearGradient
              colors={['rgba(0,122,255,0.35)', 'rgba(175,82,222,0.2)', 'transparent']}
              style={styles.blob}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>

          <View style={styles.badge}>
            <Sparkles size={14} color="#007AFF" />
            <Text style={styles.badgeTxt}>LIGHTNING-FAST INSPIRATION CAPTURE</Text>
          </View>

          <Text style={styles.h1}>
            Capture at the{'\n'}
            <Text style={styles.h1Grad}>speed of light.</Text>
          </Text>
          <Text style={styles.sub}>
            Lumi Note is a next-generation color-aesthetic capsule notepad designed
            for lightning-fast capture. Type a single sentence to instantly generate
            beautifully-styled notes, fluid to-dos, and smart reminders.
          </Text>

          <TouchableOpacity style={styles.primaryCta} onPress={onEmailAuth}>
            <Text style={styles.primaryCtaTxt}>Get Started for Free</Text>
            <ArrowRight size={20} color="#000" />
          </TouchableOpacity>

          {onGuestPress && (
            <TouchableOpacity style={styles.guestCta} onPress={onGuestPress}>
              <Text style={styles.guestCtaTxt}>Explore App as Guest</Text>
            </TouchableOpacity>
          )}

          <View style={styles.socialRow}>
            <GoogleSignInButton variant="dark" />
          </View>

          <Text style={styles.sectionTitle}>
            Seamlessly Integrated.{'\n'}
            Flawlessly Beautiful.
          </Text>
          <Text style={styles.sectionSub}>
            Experience the lightweight interface of Lumi Note — meticulously
            optimized for lists, grids, and multi-device cloud synchronization.
          </Text>

          <View style={styles.mockBrowser}>
            <View style={styles.mockTraffic}>
              <View style={[styles.dot, { backgroundColor: '#FF5F57' }]} />
              <View style={[styles.dot, { backgroundColor: '#FFBD2E' }]} />
              <View style={[styles.dot, { backgroundColor: '#28CA42' }]} />
            </View>
            <View style={styles.mockCapture}>
              <Text style={styles.mockPlaceholder}>Record your thoughts...</Text>
            </View>
            <View style={[styles.mockCard, { backgroundColor: '#FFCA28' }]}>
              <View style={styles.mockTodo} />
              <View style={styles.mockLine} />
              <View style={styles.mockTag}>
                <Text style={styles.mockTagTxt}>IDEA</Text>
              </View>
            </View>
            <View style={[styles.mockCard, { backgroundColor: '#AF52DE' }]}>
              <View style={styles.mockTodo} />
              <View style={[styles.mockLine, { width: '66%' }]} />
            </View>
            <View style={[styles.mockCard, { backgroundColor: '#007AFF' }]}>
              <Text style={styles.mockCheck}>✔</Text>
              <View style={[styles.mockLine, { width: '40%', opacity: 0.6 }]} />
            </View>
          </View>

          <Text style={styles.featureSanctuary}>The ultimate productivity sanctuary.</Text>
          <Text style={styles.featureSanctuarySub}>
            Features built deeply into the core experience.
          </Text>

          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.craftTitle}>About Lumi Note</Text>
          <Text style={styles.craftBody}>
            Lumi Note is built for creators, thinkers, and makers who want a
            faster, more beautiful way to capture ideas. We believe software
            should be fast, quiet, and respect your attention. No bloated
            features — just your mind, organized.
          </Text>

          <View style={styles.hqBox}>
            <Text style={styles.hqLbl}>COMPANY HQ</Text>
            <Text style={styles.hqLine}>1440 Innovation Park Dr.</Text>
            <Text style={styles.hqLine}>San Francisco, CA 94158</Text>
            <Text style={styles.hqLine}>United States</Text>
            <Text style={[styles.hqLbl, { marginTop: 14 }]}>DIRECT CONTACT</Text>
            <Text style={styles.hqMail}>hello@luminote.space</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Send a Message</Text>
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={contactName}
              onChangeText={setContactName}
            />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="rgba(255,255,255,0.35)"
              keyboardType="email-address"
              autoCapitalize="none"
              value={contactEmail}
              onChangeText={setContactEmail}
            />
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="What's on your mind?"
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              value={contactMsg}
              onChangeText={setContactMsg}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendDemo}>
              <Text style={styles.sendBtnTxt}>Send Transmission</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>Lumi Note</Text>
            <Text style={styles.footerCopy}>
              Designed for speed. Engineered for precision. ©{' '}
              {new Date().getFullYear()} All rights reserved.
            </Text>
            <View style={styles.footerLinks}>
              <Text style={styles.footerLink}>Terms</Text>
              <Text style={styles.footerDot}>·</Text>
              <Text style={styles.footerLink}>Privacy</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const FEATURES = [
  {
    title: 'Countdown & Deadlines',
    desc: 'Set specific dates and see exactly how many days are left. Always stay ahead of schedule.',
  },
  {
    title: 'Repeating Reminders',
    desc: 'Daily, weekly, or monthly — set your routines on autopilot. Habits are formed effortlessly.',
  },
  {
    title: 'To-Dos & Checklists',
    desc: 'Seamlessly transition any thought into a concrete to-do item. Track progress instantly.',
  },
  {
    title: 'Color Aesthetics',
    desc: 'Group by vibrant colors or strict categories. Visual organization that feels purely natural.',
  },
  {
    title: 'Adaptive Views',
    desc: 'Toggle between dynamic lists or dense grids depending on your desired scope of view.',
  },
  {
    title: 'Universal Sync',
    desc: 'Secure real-time cloud sync ensures your data perfectly mirrors across PC, tablet, and mobile.',
  },
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  brand: { color: '#FFF', fontWeight: '800', fontSize: 17 },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navLink: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14 },
  navCta: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  navCtaTxt: { color: '#000', fontWeight: '800', fontSize: 13 },
  heroGlow: { height: 120, marginTop: 8, marginBottom: -40 },
  blob: {
    position: 'absolute',
    top: 0,
    left: '8%',
    width: 300,
    height: 200,
    borderRadius: 100,
    opacity: 0.9,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginTop: 24,
  },
  badgeTxt: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  h1: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
    marginTop: 28,
    textAlign: 'center',
  },
  h1Grad: { color: '#93B8FF' },
  sub: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  primaryCta: {
    marginTop: 28,
    backgroundColor: '#FFF',
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryCtaTxt: { color: '#000', fontWeight: '900', fontSize: 16 },
  guestCta: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  guestCtaTxt: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 15 },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 44,
    lineHeight: 30,
  },
  sectionSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  mockBrowser: {
    backgroundColor: '#FAFAFC',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  mockTraffic: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  mockCapture: {
    height: 40,
    borderRadius: 999,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  mockPlaceholder: { color: 'rgba(0,0,0,0.28)', fontSize: 13, fontWeight: '600' },
  mockCard: {
    height: 56,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  mockTodo: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
    marginRight: 12,
  },
  mockLine: { width: '50%', height: 10, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.2)' },
  mockTag: {
    position: 'absolute',
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  mockTagTxt: { fontSize: 9, fontWeight: '900', color: 'rgba(0,0,0,0.5)' },
  mockCheck: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 12,
    marginRight: 12,
    width: 20,
    textAlign: 'center',
  },
  featureSanctuary: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 30,
  },
  featureSanctuarySub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 17,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  featureGrid: { gap: 12, marginTop: 16 },
  featureCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  featureTitle: { color: '#FFF', fontWeight: '800', fontSize: 17, marginBottom: 8 },
  featureDesc: { color: 'rgba(255,255,255,0.48)', fontSize: 14, lineHeight: 22 },
  craftTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 48,
    marginBottom: 12,
  },
  craftBody: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  hqBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  hqLbl: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  hqLine: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600', marginTop: 4 },
  hqMail: { color: '#007AFF', fontSize: 16, fontWeight: '700', marginTop: 6 },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 32,
  },
  formTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 18 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  sendBtn: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  sendBtnTxt: { color: '#000', fontWeight: '900', fontSize: 16 },
  footer: { alignItems: 'center', paddingVertical: 24, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  footerBrand: { color: 'rgba(255,255,255,0.85)', fontWeight: '800', marginBottom: 8 },
  footerCopy: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  footerLink: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600' },
  footerDot: { color: 'rgba(255,255,255,0.35)' },
});
