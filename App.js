import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

// Screens
import TCScreen from './src/screens/TCScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import GameScreen from './src/screens/GameScreen';

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

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer theme={customDarkTheme}>
        <Stack.Navigator 
          initialRouteName="TC"
          screenOptions={{
            headerShown: false, // Clean dopamine inducing UI shouldn't have basic headers
            animation: 'fade_from_bottom',
          }}
        >
          <Stack.Screen name="TC" component={TCScreen} />
          <Stack.Screen name="Lobby" component={LobbyScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
