import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

// Screens
import AuthScreen from './src/screens/AuthScreen';
import MainMenuScreen from './src/screens/MainMenuScreen';
import TCScreen from './src/screens/TCScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import OnlineLobbyScreen from './src/screens/OnlineLobbyScreen';
import OnlineGameScreen from './src/screens/OnlineGameScreen';
import GameScreen from './src/screens/GameScreen';

// Providers
import { AuthProvider, useAuth } from './src/context/AuthContext';

const Stack = createNativeStackNavigator();

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0f172a', // deep sleek blue/slate
    card: '#1e293b',
    text: '#f8fafc',
    primary: '#8b5cf6', // neon purple
  },
};

const RootNavigator = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return null; // Or a splash screen
  }

  return (
    <Stack.Navigator 
      initialRouteName={session ? "TC" : "Auth"}
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
      }}
    >
      {!session ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <>
          <Stack.Screen name="TC" component={TCScreen} />
          <Stack.Screen name="MainMenu" component={MainMenuScreen} />
          <Stack.Screen name="OnlineLobby" component={OnlineLobbyScreen} />
          <Stack.Screen name="OnlineGame" component={OnlineGameScreen} />
          <Stack.Screen name="Lobby" component={LobbyScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={customDarkTheme}>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
