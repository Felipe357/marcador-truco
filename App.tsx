import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const WINNING_SCORE = 12;
const STORAGE_KEY = '@truco-marcador/preferences';

type Team = 'us' | 'them';
type HandValue = 1 | 3 | 6 | 9 | 12;

type StoredPreferences = {
  teamNames: Record<Team, string>;
  wins: Record<Team, number>;
};

const NEXT_HAND_VALUE: Record<HandValue, HandValue> = {
  1: 3,
  3: 6,
  6: 9,
  9: 12,
  12: 12,
};

const HAND_MESSAGES: Record<HandValue, string> = {
  1: '',
  3: 'TRUCO!',
  6: 'SEIS!',
  9: 'NOVE!',
  12: 'DOZE!',
};

const CELEBRATION_PARTICLES = [
  { symbol: '♥', x: -126, y: -74, rotation: '-28deg', color: '#C34632' },
  { symbol: '♠', x: -78, y: -128, rotation: '18deg', color: '#1D1C1A' },
  { symbol: '♦', x: -30, y: -92, rotation: '-16deg', color: '#C34632' },
  { symbol: '♣', x: 30, y: -132, rotation: '22deg', color: '#1D1C1A' },
  { symbol: '♥', x: 82, y: -88, rotation: '30deg', color: '#C34632' },
  { symbol: '♠', x: 126, y: -52, rotation: '-22deg', color: '#1D1C1A' },
  { symbol: '♦', x: -105, y: 28, rotation: '24deg', color: '#C34632' },
  { symbol: '♣', x: 108, y: 36, rotation: '-26deg', color: '#1D1C1A' },
];

export default function App() {
  const [scores, setScores] = useState<Record<Team, number>>({ us: 0, them: 0 });
  const [handValue, setHandValue] = useState<HandValue>(1);
  const [teamNames, setTeamNames] = useState<Record<Team, string>>({
    us: 'Nós',
    them: 'Eles',
  });
  const [wins, setWins] = useState<Record<Team, number>>({ us: 0, them: 0 });
  const [draftNames, setDraftNames] = useState(teamNames);
  const [isEditingNames, setIsEditingNames] = useState(false);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [raiseMessage, setRaiseMessage] = useState('');
  const raiseAnimation = useRef(new Animated.Value(0)).current;
  const winnerAnimation = useRef(new Animated.Value(0)).current;
  const celebrationAnimation = useRef(new Animated.Value(0)).current;
  const countedWinner = useRef<Team | null>(null);

  const winner = (Object.keys(scores) as Team[]).find(
    (team) => scores[team] >= WINNING_SCORE,
  );

  useEffect(() => {
    let isMounted = true;

    async function loadPreferences() {
      try {
        const savedPreferences = await AsyncStorage.getItem(STORAGE_KEY);
        if (!savedPreferences || !isMounted) return;

        const parsed = JSON.parse(savedPreferences) as Partial<StoredPreferences>;
        const savedNames = parsed.teamNames;
        const savedWins = parsed.wins;

        if (
          savedNames &&
          typeof savedNames.us === 'string' &&
          typeof savedNames.them === 'string'
        ) {
          const restoredNames = {
            us: savedNames.us.trim() || 'Nós',
            them: savedNames.them.trim() || 'Eles',
          };
          setTeamNames(restoredNames);
          setDraftNames(restoredNames);
        }

        if (
          savedWins &&
          Number.isFinite(savedWins.us) &&
          Number.isFinite(savedWins.them)
        ) {
          setWins({
            us: Math.max(0, Math.floor(savedWins.us)),
            them: Math.max(0, Math.floor(savedWins.them)),
          });
        }
      } catch (error) {
        console.warn('Não foi possível carregar os dados salvos.', error);
      } finally {
        if (isMounted) setIsStorageLoaded(true);
      }
    }

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isStorageLoaded) return;

    const preferences: StoredPreferences = { teamNames, wins };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)).catch(
      (error) => console.warn('Não foi possível salvar os dados.', error),
    );
  }, [isStorageLoaded, teamNames, wins]);

  useEffect(() => {
    if (winner && !countedWinner.current) {
      countedWinner.current = winner;
      setWins((current) => ({
        ...current,
        [winner]: current[winner] + 1,
      }));
      return;
    }

    if (!winner && countedWinner.current) {
      const correctedWinner = countedWinner.current;
      countedWinner.current = null;
      setWins((current) => ({
        ...current,
        [correctedWinner]: Math.max(0, current[correctedWinner] - 1),
      }));
    }
  }, [winner]);

  useEffect(() => {
    if (!winner) {
      winnerAnimation.setValue(0);
      celebrationAnimation.setValue(0);
      return;
    }

    winnerAnimation.setValue(0);
    celebrationAnimation.setValue(0);

    Animated.parallel([
      Animated.spring(winnerAnimation, {
        damping: 9,
        mass: 0.8,
        stiffness: 120,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(celebrationAnimation, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [celebrationAnimation, winner, winnerAnimation]);

  function addHandToScore(team: Team) {
    if (winner) return;

    setScores((current) => ({
      ...current,
      [team]: Math.min(WINNING_SCORE, current[team] + handValue),
    }));
    setHandValue(1);
  }

  function removePoint(team: Team) {
    setScores((current) => ({
      ...current,
      [team]: Math.max(0, current[team] - 1),
    }));
  }

  function raiseHandValue() {
    const nextValue = NEXT_HAND_VALUE[handValue];
    if (nextValue === handValue) return;

    setHandValue(nextValue);
    setRaiseMessage(HAND_MESSAGES[nextValue]);
    raiseAnimation.stopAnimation();
    raiseAnimation.setValue(0);

    Animated.sequence([
      Animated.timing(raiseAnimation, {
        duration: 220,
        easing: Easing.out(Easing.back(1.8)),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.delay(360),
      Animated.timing(raiseAnimation, {
        duration: 240,
        easing: Easing.in(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setRaiseMessage('');
    });
  }

  function resetGame() {
    const hasStarted = scores.us > 0 || scores.them > 0 || handValue !== 1;
    if (!hasStarted) return;

    Alert.alert('Zerar o placar?', 'Os pontos da partida atual serão apagados.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Zerar',
        style: 'destructive',
        onPress: () => {
          countedWinner.current = null;
          setScores({ us: 0, them: 0 });
          setHandValue(1);
        },
      },
    ]);
  }

  function openNameEditor() {
    setDraftNames(teamNames);
    setIsEditingNames(true);
  }

  function saveTeamNames() {
    setTeamNames({
      us: draftNames.us.trim() || 'Nós',
      them: draftNames.them.trim() || 'Eles',
    });
    setIsEditingNames(false);
  }

  function renderTeam(team: Team) {
    const isWinner = winner === team;

    return (
      <Animated.View
        style={[
          styles.team,
          isWinner && styles.winnerTeam,
          isWinner && {
            transform: [
              {
                scale: winnerAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1.03],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.teamName} numberOfLines={1}>
          {teamNames[team].toUpperCase()}
        </Text>
        <Text style={styles.teamWins}>
          {wins[team]} {wins[team] === 1 ? 'VITÓRIA' : 'VITÓRIAS'}
        </Text>
        <Text
          style={styles.score}
          accessibilityLabel={`${teamNames[team]}: ${scores[team]} pontos`}
        >
          {scores[team]}
        </Text>

        <View style={styles.controls}>
          <Pressable
            accessibilityLabel={`Remover um ponto de ${teamNames[team]}`}
            accessibilityRole="button"
            disabled={scores[team] === 0}
            onPress={() => removePoint(team)}
            style={({ pressed }) => [
              styles.controlButton,
              styles.secondaryButton,
              scores[team] === 0 && styles.disabledButton,
              pressed && styles.pressedButton,
            ]}
          >
            <Text style={styles.secondaryButtonText}>−</Text>
          </Pressable>

          <Pressable
            accessibilityLabel={`Marcar ${handValue} ${handValue === 1 ? 'ponto' : 'pontos'} para ${teamNames[team]}`}
            accessibilityRole="button"
            disabled={Boolean(winner)}
            onPress={() => addHandToScore(team)}
            style={({ pressed }) => [
              styles.controlButton,
              styles.primaryButton,
              winner && styles.disabledButton,
              pressed && styles.pressedButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>+</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {winner && (
        <View pointerEvents="none" style={styles.celebrationLayer}>
          {CELEBRATION_PARTICLES.map((particle, index) => (
            <Animated.Text
              key={`${particle.symbol}-${index}`}
              style={[
                styles.celebrationParticle,
                { color: particle.color },
                {
                  opacity: celebrationAnimation.interpolate({
                    inputRange: [0, 0.12, 0.75, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
                  transform: [
                    {
                      translateX: celebrationAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, particle.x],
                      }),
                    },
                    {
                      translateY: celebrationAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, particle.y],
                      }),
                    },
                    {
                      rotate: celebrationAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', particle.rotation],
                      }),
                    },
                    {
                      scale: celebrationAnimation.interpolate({
                        inputRange: [0, 0.3, 1],
                        outputRange: [0.45, 1.2, 0.85],
                      }),
                    },
                  ],
                },
              ]}
            >
              {particle.symbol}
            </Animated.Text>
          ))}
        </View>
      )}

      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MARCADOR</Text>
            <Text style={styles.title}>Truco</Text>
            <Pressable
              accessibilityRole="button"
              onPress={openNameEditor}
              hitSlop={8}
            >
              <Text style={styles.editTeamsText}>EDITAR TIMES</Text>
            </Pressable>
          </View>

          <View style={styles.targetBadge}>
            <Text style={styles.targetLabel}>ATÉ</Text>
            <Text style={styles.targetScore}>{WINNING_SCORE}</Text>
          </View>
        </View>

        {winner ? (
          <Animated.View
            style={[
              styles.winnerBanner,
              {
                opacity: winnerAnimation,
                transform: [
                  {
                    translateY: winnerAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.winnerEyebrow}>FIM DE JOGO</Text>
            <Text style={styles.winnerText}>
              {teamNames[winner]} venceu!
            </Text>
          </Animated.View>
        ) : (
          <Text style={styles.hint}>Toque em + para marcar um ponto</Text>
        )}

        <View style={styles.scoreboard}>
          {renderTeam('us')}
          <View style={styles.divider} />
          {renderTeam('them')}
        </View>

        <View style={styles.handSection}>
          <View style={styles.handHeading}>
            <Text style={styles.handLabel}>VALOR DA MÃO</Text>
            <Text style={styles.handCurrent}>
              {handValue} {handValue === 1 ? 'ponto' : 'pontos'}
            </Text>
          </View>

          {Boolean(raiseMessage) && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.raiseCallout,
                {
                  opacity: raiseAnimation,
                  transform: [
                    {
                      translateY: raiseAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, -10],
                      }),
                    },
                    {
                      scale: raiseAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.7, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.raiseCalloutText}>{raiseMessage}</Text>
            </Animated.View>
          )}

          <Animated.View
            style={{
              transform: [
                {
                  scale: raiseAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.035],
                  }),
                },
              ],
            }}
          >
            <Pressable
              accessibilityLabel={
                handValue === 12
                  ? 'A mão já vale doze pontos'
                  : handValue === 1
                    ? 'Pedir truco, aumentar a mão para três pontos'
                    : `Aumentar a mão para ${NEXT_HAND_VALUE[handValue]} pontos`
              }
              accessibilityRole="button"
              disabled={Boolean(winner) || handValue === 12}
              onPress={raiseHandValue}
              style={({ pressed }) => [
                styles.raiseButton,
                (winner || handValue === 12) && styles.raiseButtonFinished,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.raiseButtonEyebrow}>
                {handValue === 1
                  ? 'AUMENTAR PARA 3'
                  : handValue === 12
                    ? 'VALOR MÁXIMO'
                    : `AUMENTAR PARA ${NEXT_HAND_VALUE[handValue]}`}
              </Text>
              <Text style={styles.raiseButtonText}>
                {handValue === 1
                  ? 'TRUCO!'
                  : handValue === 12
                    ? 'MÃO EM 12'
                    : `PEDIR ${NEXT_HAND_VALUE[handValue]}`}
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={resetGame}
          style={({ pressed }) => [
            styles.resetButton,
            scores.us === 0 &&
              scores.them === 0 &&
              handValue === 1 &&
              styles.disabledReset,
            pressed && styles.pressedButton,
          ]}
        >
          <Text style={styles.resetText}>
            {winner ? 'NOVA PARTIDA' : 'ZERAR PLACAR'}
          </Text>
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsEditingNames(false)}
        transparent
        visible={isEditingNames}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>PARTIDA</Text>
            <Text style={styles.modalTitle}>Nome dos times</Text>

            <Text style={styles.inputLabel}>PRIMEIRO TIME</Text>
            <TextInput
              autoCapitalize="words"
              maxLength={16}
              onChangeText={(us) => setDraftNames((names) => ({ ...names, us }))}
              placeholder="Nós"
              placeholderTextColor="#7B818B"
              selectTextOnFocus
              style={styles.input}
              value={draftNames.us}
            />

            <Text style={styles.inputLabel}>SEGUNDO TIME</Text>
            <TextInput
              autoCapitalize="words"
              maxLength={16}
              onChangeText={(them) =>
                setDraftNames((names) => ({ ...names, them }))
              }
              onSubmitEditing={saveTeamNames}
              placeholder="Eles"
              placeholderTextColor="#7B818B"
              selectTextOnFocus
              style={styles.input}
              value={draftNames.them}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setIsEditingNames(false)}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.cancelButton,
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.cancelButtonText}>CANCELAR</Text>
              </Pressable>
              <Pressable
                onPress={saveTeamNames}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.saveButton,
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.saveButtonText}>SALVAR</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#D1D5DB',
  },
  celebrationLayer: {
    bottom: 0,
    elevation: 20,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
  },
  celebrationParticle: {
    fontSize: 30,
    fontWeight: '900',
    left: '50%',
    position: 'absolute',
    top: '38%',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#C34632',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  title: {
    color: '#1D1C1A',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  editTeamsText: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 5,
    textDecorationLine: 'underline',
  },
  targetBadge: {
    minWidth: 64,
    alignItems: 'center',
    borderColor: '#9CA3AF',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  targetLabel: {
    color: '#777168',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  targetScore: {
    color: '#1D1C1A',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 23,
  },
  hint: {
    color: '#4B5563',
    fontSize: 14,
    marginTop: 26,
  },
  winnerBanner: {
    backgroundColor: '#1D1C1A',
    borderRadius: 18,
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  winnerEyebrow: {
    color: '#E8B7A8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  winnerText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 2,
  },
  scoreboard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  team: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 28,
    paddingVertical: 18,
  },
  winnerTeam: {
    backgroundColor: '#E5E7EB',
  },
  teamName: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.5,
    maxWidth: '88%',
  },
  teamWins: {
    color: '#6B7280',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 5,
  },
  score: {
    alignSelf: 'stretch',
    color: '#1D1C1A',
    fontSize: 88,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 104,
    marginBottom: 8,
    marginTop: 2,
    paddingHorizontal: 6,
    textAlign: 'center',
    width: '100%',
  },
  divider: {
    alignSelf: 'center',
    backgroundColor: '#9CA3AF',
    height: '62%',
    width: 1,
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    alignItems: 'center',
    borderRadius: 22,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  primaryButton: {
    backgroundColor: '#C34632',
  },
  secondaryButton: {
    backgroundColor: '#E5E7EB',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '500',
    lineHeight: 38,
  },
  secondaryButtonText: {
    color: '#1D1C1A',
    fontSize: 34,
    fontWeight: '400',
    lineHeight: 38,
  },
  disabledButton: {
    opacity: 0.28,
  },
  pressedButton: {
    opacity: 0.68,
    transform: [{ scale: 0.97 }],
  },
  handSection: {
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'visible',
    padding: 14,
    position: 'relative',
  },
  handHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  handLabel: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  handCurrent: {
    color: '#C34632',
    fontSize: 13,
    fontWeight: '800',
  },
  raiseButton: {
    alignItems: 'center',
    backgroundColor: '#1D1C1A',
    borderRadius: 15,
    minHeight: 62,
    justifyContent: 'center',
  },
  raiseButtonFinished: {
    backgroundColor: '#6B7280',
  },
  raiseButtonEyebrow: {
    color: '#D1D5DB',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  raiseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  raiseCallout: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: -54,
    zIndex: 12,
  },
  raiseCalloutText: {
    backgroundColor: '#C34632',
    borderRadius: 16,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.5,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  resetButton: {
    alignItems: 'center',
    borderColor: '#9CA3AF',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 56,
  },
  disabledReset: {
    opacity: 0.45,
  },
  resetText: {
    color: '#4D4943',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.58)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 26,
    padding: 22,
    width: '100%',
  },
  modalEyebrow: {
    color: '#C34632',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  modalTitle: {
    color: '#1D1C1A',
    fontSize: 25,
    fontWeight: '900',
    marginBottom: 22,
    marginTop: 2,
  },
  inputLabel: {
    color: '#4B5563',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
    borderRadius: 14,
    borderWidth: 1,
    color: '#1D1C1A',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalButton: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  cancelButton: {
    backgroundColor: '#E5E7EB',
  },
  saveButton: {
    backgroundColor: '#C34632',
  },
  cancelButtonText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
