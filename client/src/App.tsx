import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ActivityIndicator, View} from 'react-native';

import {initDatabase, getKey, setKey, saveMessage, getContact, saveContact} from './db/database';
import {decrypt} from './crypto/e2e';
import {socket} from './ws/socket';
import {WS_URL, SERVER_URL} from './config';

import LoginScreen from './screens/LoginScreen';
import ChatsScreen from './screens/ChatsScreen';
import ChatScreen from './screens/ChatScreen';
import SearchScreen from './screens/SearchScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    (async () => {
      await initDatabase();
      const savedToken = await getKey('token');
      const savedUser = await getKey('username');
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUsername(savedUser);
      }
      setReady(true);
    })();
  }, []);

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (!token) return;
    socket.connect(WS_URL, token);
    return () => socket.disconnect();
  }, [token]);

  // Global message handler for incoming messages (when not in chat screen)
  useEffect(() => {
    if (!token) return;

    const unsub = socket.onMessage(async (msg: any) => {
      if (msg.type === 'chat' && msg.from) {
        try {
          const sk = await getKey('secretKey');
          if (!sk) return;

          // Ensure contact exists
          let contact = await getContact(msg.from);
          if (!contact) {
            // Fetch public key from server
            const res = await fetch(
              `${SERVER_URL}/search?q=${encodeURIComponent(msg.from)}`,
              {headers: {Authorization: `Bearer ${token}`}},
            );
            if (res.ok) {
              const users = await res.json();
              const found = users.find((u: any) => u.username === msg.from);
              if (found) {
                await saveContact(found.username, found.public_key);
                contact = found;
              }
            }
          }

          if (!contact) return;

          const plaintext = decrypt(msg.ciphertext, msg.nonce, contact.public_key, sk);
          await saveMessage(msg.from, 'in', plaintext, msg.timestamp);

          if (msg.message_id) {
            socket.send({type: 'ack', message_id: msg.message_id});
          }
        } catch (e) {
          console.error('global decrypt error:', e);
        }
      }
    });
    return unsub;
  }, [token]);

  const handleAuth = (newToken: string, newUsername: string) => {
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = async () => {
    socket.disconnect();
    setToken(null);
    setUsername('');
  };

  if (!ready) {
    return (
      <View style={{flex: 1, justifyContent: 'center', backgroundColor: '#0a0a0a'}}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!token) {
    return <LoginScreen onAuth={handleAuth} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {backgroundColor: '#111'},
          headerTintColor: '#fff',
          contentStyle: {backgroundColor: '#0a0a0a'},
        }}>
        <Stack.Screen name="Chats" options={{headerShown: false}}>
          {(props) => (
            <ChatsScreen
              {...props}
              username={username}
              onLogout={handleLogout}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={({route}: any) => ({
            title: `@${route.params.contact}`,
          })}
        />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{title: 'Find User', headerShown: false}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
