import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {getChatList, setMuted} from '../db/database';

interface Props {
  navigation: any;
  username: string;
  onLogout: () => void;
}

export default function ChatsScreen({navigation, username, onLogout}: Props) {
  const [chats, setChats] = useState<any[]>([]);

  const loadChats = useCallback(() => {
    getChatList().then(setChats);
  }, []);

  useFocusEffect(loadChats);

  const toggleMute = (contact: string, currentlyMuted: boolean) => {
    const action = currentlyMuted ? 'Unmute' : 'Mute';
    Alert.alert(
      `${action} @${contact}?`,
      currentlyMuted
        ? 'You will receive notifications again'
        : 'You will not receive notifications',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: action,
          onPress: async () => {
            await setMuted(contact, !currentlyMuted);
            loadChats();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SOS</Text>
        <Text style={styles.headerUser}>@{username}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Search')}
            style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>X</Text>
          </TouchableOpacity>
        </View>
      </View>

      {chats.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No chats yet</Text>
          <Text style={styles.emptyHint}>Tap + to find someone</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.username}
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.chatItem}
              onPress={() =>
                navigation.navigate('Chat', {contact: item.username})
              }
              onLongPress={() => toggleMute(item.username, !!item.muted)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.username[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.chatInfo}>
                <View style={styles.chatNameRow}>
                  <Text style={styles.chatName}>@{item.username}</Text>
                  {!!item.muted && (
                    <Text style={styles.mutedBadge}>muted</Text>
                  )}
                </View>
                <Text style={styles.chatPreview} numberOfLines={1}>
                  {item.lastMessage || 'No messages'}
                </Text>
              </View>
              {item.lastTime && (
                <Text style={styles.chatTime}>
                  {new Date(item.lastTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0a'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {fontSize: 24, fontWeight: 'bold', color: '#fff'},
  headerUser: {fontSize: 14, color: '#666', marginLeft: 12, flex: 1},
  headerActions: {flexDirection: 'row', gap: 8},
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {color: '#fff', fontSize: 18, fontWeight: '600'},
  empty: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyText: {color: '#666', fontSize: 18},
  emptyHint: {color: '#444', fontSize: 14, marginTop: 8},
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {color: '#fff', fontSize: 20, fontWeight: 'bold'},
  chatInfo: {flex: 1, marginLeft: 12},
  chatNameRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  chatName: {color: '#fff', fontSize: 16, fontWeight: '500'},
  mutedBadge: {color: '#666', fontSize: 11, backgroundColor: '#1a1a1a', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4},
  chatPreview: {color: '#888', fontSize: 14, marginTop: 2},
  chatTime: {color: '#666', fontSize: 12},
});
