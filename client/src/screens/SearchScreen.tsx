import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {SERVER_URL} from '../config';
import {getKey, saveContact} from '../db/database';

interface Props {
  navigation: any;
}

export default function SearchScreen({navigation}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const search = async () => {
    if (query.trim().length < 1) return;
    try {
      const token = await getKey('token');
      const res = await fetch(
        `${SERVER_URL}/search?q=${encodeURIComponent(query.trim())}`,
        {headers: {Authorization: `Bearer ${token}`}},
      );
      if (!res.ok) {
        Alert.alert('Error', await res.text());
        return;
      }
      setResults(await res.json());
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const startChat = async (user: {username: string; public_key: string}) => {
    await saveContact(user.username, user.public_key);
    navigation.navigate('Chat', {contact: user.username});
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search username..."
          placeholderTextColor="#666"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          autoCapitalize="none"
          autoFocus
        />
        <TouchableOpacity style={styles.searchBtn} onPress={search}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.username}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.resultItem}
            onPress={() => startChat(item)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.username[0].toUpperCase()}
              </Text>
            </View>
            <Text style={styles.resultName}>@{item.username}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.length > 0 ? (
            <Text style={styles.empty}>No users found</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0a'},
  searchBar: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  searchBtn: {
    marginLeft: 8,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: {color: '#fff', fontWeight: '600'},
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {color: '#fff', fontSize: 18, fontWeight: 'bold'},
  resultName: {color: '#fff', fontSize: 16, marginLeft: 12},
  empty: {color: '#666', textAlign: 'center', marginTop: 32},
});
