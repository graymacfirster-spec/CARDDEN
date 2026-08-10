import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View } from 'react-native';

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
import { COLORS } from './src/theme/casino';

const Stack = createNativeStackNavigator();

const casinoTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.feltDeep,
    card: COLORS.woodDark,
    text: COLORS.cream,
    border: COLORS.goldDim,
    primary: COLORS.gold,
  },
};

const RootNavigator = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.feltDeep, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={session ? 'TC' : 'Auth'}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: COLORS.feltDeep },
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" hidden />
          <NavigationContainer theme={casinoTheme}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
