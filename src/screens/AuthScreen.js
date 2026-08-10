import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';
import FeltTable from '../components/FeltTable';
import { BrassButton } from '../components/TableUI';
import { COLORS, FONTS, RADIUS, shadow } from '../theme/casino';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [username, setUsername] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const [authError, setAuthError] = useState('');

  const validateEmail = (text) => {
    setEmail(text);
    setAuthError('');
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (text && !regex.test(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const validatePassword = (text) => {
    setPassword(text);
    setAuthError('');
    if (text && text.length < 6) {
      setPasswordError('Password must be at least 6 characters');
    } else {
      setPasswordError('');
    }
  };

  const handleAuth = async () => {
    setAuthError('');
    if (!email || !password || (!isLogin && !username)) {
      setAuthError('Please fill in all fields.');
      return;
    }
    if (emailError || passwordError) {
      setAuthError('Please fix validation errors before submitting.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Check if username is taken
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username)
          .maybeSingle();
          
        if (existingProfile) {
          setAuthError('Username is already taken. Please choose another one.');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        // If email confirmation is enabled, session will be null
        if (!data.session) {
          setAuthError('Success: Check your email to confirm your account!');
          return;
        }

        // Create profile for new user if session exists
        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{ id: data.user.id, username }]);
          if (profileError) {
            console.error('Profile creation error:', profileError);
            setAuthError('Notice: Account created but profile setup failed.');
          } else {
            setAuthError('Success: Account created successfully!');
          }
        }
      }
    } catch (error) {
      setAuthError(error.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeltTable>
      <View style={styles.container}>
        <Text style={styles.title}>CARDDEN</Text>
        <Text style={styles.kicker}>MEMBERS ONLY</Text>
      
      <View style={styles.form}>
        {!!authError && (
          <View style={{ backgroundColor: 'rgba(179, 18, 31, 0.22)', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.danger }}>
            <Text style={{ color: COLORS.cream, textAlign: 'center', fontWeight: '700', fontFamily: FONTS.ui }}>{authError}</Text>
          </View>
        )}
        {!isLogin && (
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="rgba(245,239,224,0.35)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        )}
        <TextInput
          style={[styles.input, emailError ? styles.inputError : null]}
          placeholder="Email"
          placeholderTextColor="rgba(245,239,224,0.35)"
          value={email}
          onChangeText={validateEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        <TextInput
          style={[styles.input, passwordError ? styles.inputError : null]}
          placeholder="Password"
          placeholderTextColor="rgba(245,239,224,0.35)"
          value={password}
          onChangeText={validatePassword}
          secureTextEntry
        />
        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
        
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.gold} />
          </View>
        ) : (
          <BrassButton
            label={isLogin ? 'ENTER THE HOUSE' : 'OPEN AN ACCOUNT'}
            tone="gold"
            onPress={handleAuth}
          />
        )}

        <Pressable onPress={() => setIsLogin(!isLogin)} style={styles.switchBtn} hitSlop={8}>
          <Text style={styles.switchText}>
            {isLogin ? 'No account yet? Sign up' : 'Already a member? Log in'}
          </Text>
        </Pressable>
        </View>
      </View>
    </FeltTable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 44,
    fontWeight: '700',
    color: COLORS.goldBright,
    letterSpacing: 8,
  },
  kicker: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 5,
    color: COLORS.creamDim,
    fontWeight: '700',
    marginBottom: 26,
  },
  form: {
    width: '100%',
    maxWidth: 420,
    gap: 12,
    padding: 20,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
    backgroundColor: 'rgba(3, 26, 15, 0.72)',
    ...shadow(12),
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.42)',
    color: COLORS.cream,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    fontFamily: FONTS.ui,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
  },
  inputError: { borderColor: COLORS.danger },
  errorText: {
    fontFamily: FONTS.ui,
    color: COLORS.danger,
    fontSize: 11,
    marginTop: -6,
    marginLeft: 4,
  },
  loadingBox: { paddingVertical: 14, alignItems: 'center' },
  switchBtn: { alignItems: 'center', marginTop: 4 },
  switchText: { fontFamily: FONTS.ui, color: COLORS.creamDim, fontSize: 12 },
});
