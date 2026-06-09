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
import {
  ArrowRight,
  Sparkles,
  CalendarDays,
  Repeat,
  CheckSquare,
  Palette,
  Tablet,
  Monitor,
  Star,
  Pin,
  Clock,
  Bell,
  Play,
  Apple,
} from 'lucide-react-native';
import { GoogleSignInButton } from './GoogleSignInButton';
import { AppLogo } from './AppLogo';

type Props = {
  onEmailAuth: () => void;
  onGuestPress?: () => void;
};

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
          {/* Navbar */}
          <View style={styles.nav}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppLogo width={40} height={40} />
              <Text style={styles.brand}>Lumi Note</Text>
            </View>
            <View style={styles.navActions}>
              <TouchableOpacity onPress={onEmailAuth}>
                <Text style={styles.navLink}>Log in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.navCta} onPress={onEmailAuth}>
                <Text style={styles.navCtaTxt}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero glow */}
          <View style={styles.heroGlow}>
            <LinearGradient
              colors={['rgba(0,122,255,0.35)', 'rgba(175,82,222,0.2)', 'transparent']}
              style={styles.blob}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>

          {/* Sparkles badge */}
          <View style={styles.badge}>
            <Sparkles size={14} color="#FF2D55" />
            <Text style={styles.badgeTxt}>THE NEXT-GEN COLOR AESTHETIC NOTEBOOK</Text>
          </View>

          {/* Main Title */}
          <Text style={styles.h1}>
            Create high-aesthetic notes,{'\n'}
            <Text style={styles.h1Highlight}>todos & reminders in a single breath.</Text>
          </Text>
          <Text style={styles.sub}>
            Lumi Note is a next-generation color-aesthetic capsule notepad designed for lightning-fast capture. Type a single sentence to instantly generate beautifully-styled notes, fluid to-dos, and smart reminders. Bring harmony to your daily flow—where rapid organization meets premium design.
          </Text>

          {/* CTA Buttons */}
          <TouchableOpacity style={styles.primaryCta} onPress={onEmailAuth}>
            <Text style={styles.primaryCtaTxt}>Start Free Capture</Text>
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

          {/* Brand Philosophy Section */}
          <Text style={styles.sectionTitle}>
            Color + Mindflow{'\n'}
            = Lumi Note
          </Text>
          <Text style={styles.sectionSubTheme}>
            Why color-coded note-taking works
          </Text>
          <View style={styles.philosophyContainer}>
            <Text style={styles.philosophyText}>
              Monochrome lists make all your thoughts look identical. But a fleeting inspiration shouldn't look exactly like a grocery list. Your brain naturally prioritizes by color, and your notes should do the same.
            </Text>
            <Text style={[styles.philosophyText, { marginTop: 12 }]}>
              Lumi Note combines minimalist card layouts with intuitive color keys. Categorize and prioritize instantly with beautiful chromative cues, keeping your daily capture fast, natural, and highly visual.
            </Text>
          </View>

          {/* Device Mockup section */}
          <Text style={styles.sectionTitle}>Sleek layout. Fluid sync.</Text>
          <Text style={styles.sectionSub}>
            Experience the lightweight interface of Lumi Note—meticulously optimized for lists, grids, and multi-device cloud synchronization.
          </Text>

          {/* Mock App Cards */}
          <View style={styles.mockAppContainer}>
            {/* Card 1: Orange - Product Launch Presentation */}
            <View style={[styles.mockCard, { backgroundColor: '#FF9500' }]}>
              {/* Star and Pin in top right */}
              <View style={styles.mockAbsoluteIcons}>
                <Pin size={10} color="rgba(255,255,255,0.75)" />
                <Star size={10} color="#FFD700" fill="#FFD700" />
              </View>
              
              <View style={styles.mockCardBody}>
                <View style={styles.mockTodoCheckbox} />
                <Text style={styles.mockCardText}>Product Launch Presentation</Text>
              </View>
              
              <View style={styles.mockCardFooter}>
                <View style={styles.mockBadgeRow}>
                  <View style={styles.mockBadge}>
                    <Text style={styles.mockBadgeText}>DESIGN</Text>
                  </View>
                  <View style={styles.mockBadgeDark}>
                    <Text style={styles.mockBadgeText}>#LAUNCH</Text>
                  </View>
                </View>
                <View style={styles.mockTimeRow}>
                  <Clock size={10} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.mockTimeText}>MAY 24</Text>
                </View>
              </View>
            </View>

            {/* Card 2: Blue - Update landing page aesthetics (Completed) */}
            <View style={[styles.mockCard, { backgroundColor: '#007AFF' }]}>
              <View style={styles.mockCardBody}>
                <View style={styles.mockTodoChecked}>
                  <Text style={styles.mockCheckIcon}>✔</Text>
                </View>
                <Text style={[styles.mockCardText, styles.mockTextCompleted]}>
                  Update landing page aesthetics
                </Text>
              </View>
              
              <View style={styles.mockCardFooter}>
                <View style={styles.mockBadgeRow}>
                  <View style={styles.mockBadge}>
                    <Text style={styles.mockBadgeText}>WORK</Text>
                  </View>
                  <View style={styles.mockBadgeDark}>
                    <Text style={styles.mockBadgeText}>#TODAY</Text>
                  </View>
                </View>
                <View style={styles.mockTimeRow}>
                  <Clock size={10} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.mockTimeText}>MAY 28</Text>
                </View>
              </View>
            </View>

            {/* Card 3: Purple - Weekly review with engineering team */}
            <View style={[styles.mockCard, { backgroundColor: '#AF52DE' }]}>
              {/* Bell in bottom right */}
              <View style={styles.mockAbsoluteBell}>
                <Bell size={10} color="rgba(255,255,255,0.75)" />
              </View>

              <View style={styles.mockCardBody}>
                <View style={styles.mockTodoCheckbox} />
                <Text style={styles.mockCardText}>Weekly review with engineering team</Text>
              </View>
              
              <View style={styles.mockCardFooter}>
                <View style={styles.mockBadgeRow}>
                  <View style={styles.mockBadge}>
                    <Text style={styles.mockBadgeText}>TEAM</Text>
                  </View>
                  <View style={styles.mockBadgeDark}>
                    <Text style={styles.mockBadgeText}>#SYNC</Text>
                  </View>
                </View>
                {/* Keep space empty on right since Bell is absolute */}
                <View style={{ width: 16 }} />
              </View>
            </View>
          </View>

          {/* Cloud Sync Ecosystem */}
          <Text style={styles.storeTitle}>CLOUD SYNC ECOSYSTEM</Text>
          <View style={styles.storeButtonsContainer}>
            <TouchableOpacity style={styles.storeBtn} activeOpacity={0.8}>
              <Apple size={22} color="#FFF" />
              <View style={styles.storeBtnTextContainer}>
                <Text style={styles.storeBtnSub}>Download on the</Text>
                <Text style={styles.storeBtnMain}>App Store</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.storeBtn} activeOpacity={0.8}>
              <Play size={18} color="#FFF" fill="#FFF" />
              <View style={styles.storeBtnTextContainer}>
                <Text style={styles.storeBtnSub}>GET IT ON</Text>
                <Text style={styles.storeBtnMain}>Google Play</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Feature Sanctuary */}
          <Text style={styles.featureSanctuary}>Built for fast minds.</Text>
          <Text style={styles.featureSanctuarySub}>
            Clean, friction-free features to help you capture and organize without breaking your flow.
          </Text>

          {/* Feature Grid */}
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => {
              const IconComp = f.icon;
              return (
                <View key={f.title} style={styles.featureCard}>
                  <View style={styles.featureIconContainer}>
                    <IconComp size={24} color="#FFF" />
                  </View>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              );
            })}
          </View>

          {/* About & HQ */}
          <Text style={styles.craftTitle}>About Lumi Note</Text>
          <Text style={styles.craftBody}>
            Lumi Note is built for creators, thinkers, and makers who want a faster, more beautiful way to capture ideas. We believe software should be fast, quiet, and respect your attention. No bloated features—just your mind, organized.
          </Text>

          <View style={styles.hqBox}>
            <Text style={styles.hqLbl}>COMPANY HQ</Text>
            <Text style={styles.hqLine}>1440 Innovation Park Dr.</Text>
            <Text style={styles.hqLine}>San Francisco, CA 94158</Text>
            <Text style={styles.hqLine}>United States</Text>
            <Text style={[styles.hqLbl, { marginTop: 14 }]}>DIRECT CONTACT</Text>
            <Text style={styles.hqMail}>hello@luminote.space</Text>
          </View>

          {/* Contact Form */}
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
              <Text style={styles.sendBtnTxt}>Send Message</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <AppLogo width={48} height={48} />
              <Text style={styles.footerBrand}>Lumi Note</Text>
            </View>
            <Text style={styles.footerCopy}>
              Capture thoughts in full color. ©{' '}
              {new Date().getFullYear()} All rights reserved.
            </Text>
            <View style={styles.footerLinks}>
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
    title: 'Countdowns & Deadlines',
    desc: 'Keep track of high-priority tasks. See exactly how many days are left to execute.',
    icon: CalendarDays,
  },
  {
    title: 'Smart Recurrence',
    desc: 'Set notes to repeat daily, weekly, or monthly. Perfect for keeping track of your routines.',
    icon: Repeat,
  },
  {
    title: 'Task Checklists',
    desc: 'Turn text into actionable check-boxes instantly. Clear tasks with zero friction.',
    icon: CheckSquare,
  },
  {
    title: 'Color-Coded Library',
    desc: 'Organize thoughts using custom color keys. Navigate your notes visually instead of reading through endless text.',
    icon: Palette,
  },
  {
    title: 'List & Grid Layouts',
    desc: 'Switch instantly between a minimal chronological stream and an expansive visual grid.',
    icon: Tablet,
  },
  {
    title: 'Real-Time Cloud Sync',
    desc: 'Securely sync your notes across all devices instantly. Your ideas are always up to date.',
    icon: Monitor,
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
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
    marginTop: 28,
    textAlign: 'center',
  },
  h1Highlight: { color: '#FF2D55' },
  sub: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 15,
    lineHeight: 24,
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
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
    lineHeight: 22,
  },
  sectionSubTheme: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginTop: 6,
  },
  philosophyContainer: {
    marginTop: 16,
    paddingHorizontal: 10,
  },
  philosophyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
  },
  mockAppContainer: {
    backgroundColor: '#111',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  mockCard: {
    borderRadius: 16,
    padding: 12,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mockCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  mockTodoCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  mockTodoChecked: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockCheckIcon: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  mockCardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mockBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  mockCardLine: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: 4,
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
    fontSize: 16,
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
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
  mockAbsoluteIcons: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 4 },
  mockAbsoluteBell: { position: 'absolute', bottom: 10, right: 10 },
  mockCardBody: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginRight: 24 },
  mockCardText: { color: '#FFF', fontSize: 14, fontWeight: '700', flex: 1 },
  mockTextCompleted: { textDecorationLine: 'line-through', opacity: 0.7 },
  mockCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  mockBadgeRow: { flexDirection: 'row', gap: 6 },
  mockBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  mockBadgeDark: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  mockTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mockTimeText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700' },
  storeTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  storeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  storeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1D1D1F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: 146,
  },
  storeBtnTextContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  storeBtnSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 7,
    fontWeight: '600',
    textTransform: 'uppercase',
    lineHeight: 8,
  },
  storeBtnMain: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
});
