import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import FeltTable from '../components/FeltTable';
import { BrassButton } from '../components/TableUI';
import { COLORS, FONTS, RADIUS, shadow } from '../theme/casino';

export default function MainMenuScreen({ navigation }) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleHostGame = async () => {
    setLoading(true);
    try {
      const code = generateRoomCode();
      const { data: room, error } = await supabase
        .from('rooms')
        .insert([{ room_code: code, host_id: profile.id, status: 'waiting' }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Add host as participant
      await supabase
        .from('room_participants')
        .insert([{ room_id: room.id, profile_id: profile.id, role: 'participant' }]);
      
      navigation.navigate('OnlineLobby', { roomId: room.id, roomCode: code, isHost: true, role: 'participant' });
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (role) => {
    if (!roomCode) {
      Alert.alert('Error', 'Please enter a room code');
      return;
    }
    
    setLoading(true);
    try {
      // Find room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .single();
        
      if (roomError || !room) {
        throw new Error('That is the wrong room code.');
      }
      if (room.status !== 'waiting' && role === 'participant') {
        throw new Error('Game has already started. You can only join as an audience member.');
      }
      
      // Join room
      const { error: joinError } = await supabase
        .from('room_participants')
        .insert([{ room_id: room.id, profile_id: profile.id, role: role }]);
        
      // Ignore unique constraint error if already joined
      if (joinError && joinError.code !== '23505') {
        throw joinError;
      }
      
      navigation.navigate('OnlineLobby', { roomId: room.id, roomCode: room.room_code, isHost: false, role });
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <FeltTable>
      <View style={[styles.screen, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>CARDDEN</Text>
            <Text style={styles.tagline}>THE HOUSE IS OPEN</Text>
          </View>
          <View style={styles.playerChip}>
            <Text style={styles.playerChipLabel}>SEATED AS</Text>
            <Text style={styles.playerChipName}>{(profile?.username || 'PLAYER').toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.columns}>
          {/* Host */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>OPEN A TABLE</Text>
            <Text style={styles.panelBody}>
              Deal a private room and share the code. You run the house rules.
            </Text>
            <BrassButton label="HOST ONLINE GAME" tone="gold" onPress={handleHostGame} disabled={loading} />

            <View style={styles.divider} />

            <Text style={styles.panelTitle}>PRACTICE</Text>
            <BrassButton
              label="LOCAL PLAY VS BOTS"
              tone="slate"
              onPress={() => navigation.navigate('Lobby')}
            />
          </View>

          {/* Join */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>TAKE A SEAT</Text>
            <TextInput
              style={styles.input}
              placeholder="ROOM CODE"
              placeholderTextColor="rgba(245,239,224,0.35)"
              value={roomCode}
              onChangeText={setRoomCode}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />
            <View style={styles.row}>
              <BrassButton
                label="JOIN AS PLAYER"
                tone="green"
                onPress={() => handleJoinGame('participant')}
                disabled={loading}
                style={styles.grow}
              />
              <BrassButton
                label="SPECTATE"
                tone="slate"
                onPress={() => handleJoinGame('audience')}
                disabled={loading}
                style={styles.grow}
              />
            </View>

            <View style={styles.divider} />

            <Pressable onPress={handleLogout} hitSlop={8} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>LEAVE THE FLOOR</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      )}
    </FeltTable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 22, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: {
    fontFamily: FONTS.display,
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.goldBright,
    letterSpacing: 6,
  },
  tagline: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 4,
    color: COLORS.creamDim,
    fontWeight: '700',
  },
  playerChip: {
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  playerChipLabel: {
    fontFamily: FONTS.ui,
    fontSize: 8,
    letterSpacing: 2,
    color: COLORS.creamDim,
    fontWeight: '700',
  },
  playerChipName: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    letterSpacing: 1.5,
    color: COLORS.cream,
    fontWeight: '800',
  },

  columns: { flex: 1, flexDirection: 'row', gap: 16 },
  panel: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
    backgroundColor: 'rgba(3, 26, 15, 0.7)',
    padding: 18,
    gap: 12,
    justifyContent: 'center',
    ...shadow(10),
  },
  panelTitle: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    letterSpacing: 3,
    color: COLORS.goldBright,
    fontWeight: '800',
  },
  panelBody: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.creamDim,
  },
  divider: { height: 1, backgroundColor: 'rgba(212,175,55,0.25)', marginVertical: 4 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    color: COLORS.cream,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    textAlign: 'center',
    fontFamily: FONTS.display,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8,
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
  },
  row: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  logoutBtn: { alignItems: 'center' },
  logoutText: {
    fontFamily: FONTS.ui,
    color: COLORS.danger,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
