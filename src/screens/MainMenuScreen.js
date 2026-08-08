import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

export default function MainMenuScreen({ navigation }) {
  const { profile } = useAuth();
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
    <View style={styles.container}>
      <Text style={styles.title}>MAIN MENU</Text>
      <Text style={styles.subtitle}>Welcome, {profile?.username || 'Player'}</Text>
      
      <View style={styles.card}>
        <TouchableOpacity style={[styles.btn, styles.hostBtn]} onPress={handleHostGame} disabled={loading}>
          <Text style={styles.btnText}>HOST ONLINE GAME</Text>
        </TouchableOpacity>
        
        <View style={styles.divider} />
        
        <Text style={styles.label}>JOIN GAME</Text>
        <TextInput 
          style={styles.input}
          placeholder="Enter Room Code"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={roomCode}
          onChangeText={setRoomCode}
          autoCapitalize="characters"
          maxLength={6}
        />
        
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.joinBtn, { flex: 1, marginRight: 5 }]} onPress={() => handleJoinGame('participant')} disabled={loading}>
            <Text style={styles.btnTextSmall}>JOIN AS PLAYER</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.spectateBtn, { flex: 1, marginLeft: 5 }]} onPress={() => handleJoinGame('audience')} disabled={loading}>
            <Text style={styles.btnTextSmall}>SPECTATE</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.btn, styles.localBtn]} onPress={() => navigation.navigate('Lobby')}>
          <Text style={styles.btnText}>LOCAL PLAY (BOTS)</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>LOGOUT</Text>
      </TouchableOpacity>
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00ffcc" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#00ffcc',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 255, 204, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 40,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  btn: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  hostBtn: {
    backgroundColor: '#ff00ea',
    shadowColor: '#ff00ea',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  joinBtn: {
    backgroundColor: '#8b5cf6',
  },
  spectateBtn: {
    backgroundColor: '#3b82f6',
  },
  localBtn: {
    backgroundColor: '#475569',
  },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  btnTextSmall: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 20,
  },
  label: {
    color: '#f8fafc',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    padding: 15,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 5,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logoutBtn: {
    marginTop: 30,
    alignItems: 'center',
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
