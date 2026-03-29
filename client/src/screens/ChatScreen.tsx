import React, {useEffect, useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {encrypt, decrypt} from '../crypto/e2e';
import {
  getMessages,
  isMuted,
  setMuted,
  saveMessage,
  getContact,
  getKey,
} from '../db/database';
import {socket} from '../ws/socket';

interface Props {
  route: any;
  navigation: any;
}

export default function ChatScreen({route, navigation}: Props) {
  const {contact} = route.params;
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [mySecretKey, setMySecretKey] = useState('');
  const [theirPublicKey, setTheirPublicKey] = useState('');
  const [muted, setMutedState] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Mute toggle in header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={async () => {
            await setMuted(contact, !muted);
            setMutedState(!muted);
          }}
          style={{paddingHorizontal: 12, paddingVertical: 4}}>
          <Text style={{color: muted ? '#ef4444' : '#666', fontSize: 13}}>
            {muted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [contact, muted, navigation]);

  useEffect(() => {
    (async () => {
      const sk = await getKey('secretKey');
      if (sk) setMySecretKey(sk);
      setMutedState(await isMuted(contact));

      const c = await getContact(contact);
      if (c) setTheirPublicKey(c.public_key);
    })();
  }, [contact]);

  const loadMessages = useCallback(async () => {
    const msgs = await getMessages(contact);
    setMessages(msgs);
  }, [contact]);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [loadMessages]),
  );

  useEffect(() => {
    const unsub = socket.onMessage(async (msg) => {
      if (msg.type === 'chat' && msg.from === contact) {
        try {
          const plaintext = decrypt(
            msg.ciphertext,
            msg.nonce,
            theirPublicKey,
            mySecretKey,
          );
          await saveMessage(contact, 'in', plaintext, msg.timestamp);
          loadMessages();

          // Send ack
          if (msg.message_id) {
            socket.send({type: 'ack', message_id: msg.message_id});
          }
        } catch (e) {
          console.error('decrypt error:', e);
        }
      }
    });
    return unsub;
  }, [contact, theirPublicKey, mySecretKey, loadMessages]);

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!mySecretKey || !theirPublicKey) {
      Alert.alert('Error', 'Encryption keys not ready. Try reopening the chat.');
      return;
    }

    try {
      const {ciphertext, nonce} = encrypt(trimmed, theirPublicKey, mySecretKey);
      socket.send({
        type: 'chat',
        to: contact,
        ciphertext,
        nonce,
      });
      await saveMessage(contact, 'out', trimmed);
      setText('');
      loadMessages();
    } catch (e) {
      console.error('send error:', e);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({animated: false})
        }
        renderItem={({item}) => (
          <View
            style={[
              styles.bubble,
              item.direction === 'out' ? styles.bubbleOut : styles.bubbleIn,
            ]}>
            <Text style={styles.bubbleText}>{item.plaintext}</Text>
            <Text style={styles.bubbleTime}>
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.messagesList}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor="#666"
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0a'},
  messagesList: {padding: 16, paddingBottom: 8},
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  bubbleOut: {
    backgroundColor: '#2563eb',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleIn: {
    backgroundColor: '#1a1a1a',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {color: '#fff', fontSize: 15},
  bubbleTime: {color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4, alignSelf: 'flex-end'},
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#222',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendBtnText: {color: '#fff', fontWeight: '600', fontSize: 15},
});
