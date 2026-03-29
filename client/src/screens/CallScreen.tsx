import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';

interface Props {
  route: any;
  navigation: any;
}

export default function CallScreen({navigation}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Use web client for calls</Text>
      <Text style={styles.sub}>{`Open in browser:\nhttp://148.253.212.8:9090/web/`}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
        <Text style={styles.btnText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', padding: 24},
  text: {color: '#fff', fontSize: 18, marginBottom: 12},
  sub: {color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 24},
  btn: {backgroundColor: '#222', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12},
  btnText: {color: '#fff', fontSize: 16},
});
