import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';

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
    <View style={styles.container}>
      <Text style={styles.title}>CARDDEN</Text>
      
      <View style={styles.form}>
        {!!authError && (
          <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ef4444' }}>
            <Text style={{ color: '#ef4444', textAlign: 'center', fontWeight: 'bold' }}>{authError}</Text>
          </View>
        )}
        {!isLogin && (
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        )}
        <TextInput
          style={[styles.input, emailError ? styles.inputError : null]}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={email}
          onChangeText={validateEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        <TextInput
          style={[styles.input, passwordError ? styles.inputError : null]}
          placeholder="Password"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={password}
          onChangeText={validatePassword}
          secureTextEntry
        />
        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isLogin ? 'LOGIN' : 'SIGN UP'}</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchBtn}>
          <Text style={styles.switchText}>
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: '#8b5cf6',
    marginBottom: 40,
    textShadow: '0px 0px 20px rgba(139, 92, 246, 0.5)',
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 15,
    marginLeft: 5,
  },
  button: {
    backgroundColor: '#ff00ea',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    boxShadow: '0px 0px 10px rgba(255, 0, 234, 0.5)',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  switchBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
