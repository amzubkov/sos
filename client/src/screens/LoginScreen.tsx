import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import nacl from 'tweetnacl';
import {encodeBase64, decodeBase64, decodeUTF8} from 'tweetnacl-util';
import {SERVER_URL} from '../config';
import {generateKeyPair} from '../crypto/e2e';
import {setKey, getKey} from '../db/database';

interface Props {
  onAuth: (token: string, username: string) => void;
}

export default function LoginScreen({onAuth}: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // Fetch server public key for encrypted auth
      const hsRes = await fetch(`${SERVER_URL}/handshake`);
      if (!hsRes.ok) {
        Alert.alert('Error', 'Failed to connect to server');
        return;
      }
      const {public_key: serverPubB64} = await hsRes.json();
      const serverPub = decodeBase64(serverPubB64);

      // Encrypt password with ephemeral key + server public key
      const ephemeral = nacl.box.keyPair();
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const encrypted = nacl.box(
        decodeUTF8(password),
        nonce,
        serverPub,
        ephemeral.secretKey,
      );

      let body: any = {
        username: username.trim(),
        ephemeral_key: encodeBase64(ephemeral.publicKey),
        encrypted: encodeBase64(encrypted),
        nonce: encodeBase64(nonce),
      };

      // Always generate/ensure keypair exists
      const existingSecret = await getKey('secretKey');
      if (isRegister || !existingSecret) {
        const kp = generateKeyPair();
        body.public_key = kp.publicKey;
        await setKey('secretKey', kp.secretKey);
        await setKey('publicKey', kp.publicKey);
      }

      const endpoint = isRegister ? '/register' : '/login';
      const res = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        Alert.alert('Error', text);
        return;
      }

      const data = await res.json();
      await setKey('token', data.token);
      await setKey('username', data.username);
      onAuth(data.token, data.username);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SOS</Text>
      <Text style={styles.subtitle}>
        {isRegister ? 'Create Account' : 'Sign In'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#666"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#666"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={submit}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {isRegister ? 'Register' : 'Login'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
        <Text style={styles.link}>
          {isRegister
            ? 'Already have an account? Sign in'
            : "Don't have an account? Register"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0a0a0a',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: '#2563eb',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
  },
});
