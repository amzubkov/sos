import React, {useEffect, useRef, useState, useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import {SERVER_URL} from '../config';
import {getKey} from '../db/database';
import {socket} from '../ws/socket';

interface Props {
  route: any;
  navigation: any;
}

export default function CallScreen({route, navigation}: Props) {
  const {contact, incoming, sdp: incomingSdp} = route.params;
  const [callState, setCallState] = useState<
    'connecting' | 'ringing' | 'active' | 'ended'
  >(incoming ? 'ringing' : 'connecting');
  const [duration, setDuration] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
  }, []);

  const hangup = useCallback(() => {
    socket.send({type: 'call_hangup', to: contact});
    cleanup();
    setCallState('ended');
    setTimeout(() => navigation.goBack(), 500);
  }, [contact, cleanup, navigation]);

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      // Get TURN credentials
      const token = await getKey('token');
      let iceServers: any[] = [{urls: 'stun:148.253.212.8:3478'}];

      try {
        const res = await fetch(`${SERVER_URL}/turn`, {
          headers: {Authorization: `Bearer ${token}`},
        });
        if (res.ok) {
          const creds = await res.json();
          iceServers = creds.uris.map((uri: string) => ({
            urls: uri,
            username: creds.username,
            credential: creds.password,
          }));
          // Add STUN as well
          iceServers.unshift({urls: 'stun:148.253.212.8:3478'});
        }
      } catch (e) {
        console.log('TURN fetch failed, using STUN only');
      }

      const pc = new RTCPeerConnection({iceServers});
      pcRef.current = pc;

      // Get audio stream
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // @ts-ignore — react-native-webrtc uses event properties
      pc.addEventListener('icecandidate', (event: any) => {
        if (event.candidate) {
          socket.send({
            type: 'call_ice',
            to: contact,
            candidate: JSON.stringify(event.candidate),
          });
        }
      });

      // @ts-ignore
      pc.addEventListener('connectionstatechange', () => {
        if (!mounted) return;
        // @ts-ignore
        if (pc.connectionState === 'connected') {
          setCallState('active');
          timerRef.current = setInterval(() => {
            setDuration((d) => d + 1);
          }, 1000);
          // @ts-ignore
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          hangup();
        }
      });

      if (incoming && incomingSdp) {
        // Incoming call — set remote offer and create answer
        await pc.setRemoteDescription(
          new RTCSessionDescription(JSON.parse(incomingSdp)),
        );
        // Process queued ICE candidates
        for (const c of iceCandidatesQueue.current) {
          await pc.addIceCandidate(c);
        }
        iceCandidatesQueue.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.send({
          type: 'call_answer',
          to: contact,
          sdp: JSON.stringify(answer),
        });
        setCallState('active');
      } else {
        // Outgoing call — create offer
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        socket.send({
          type: 'call_offer',
          to: contact,
          sdp: JSON.stringify(offer),
        });
        setCallState('ringing');
      }
    };

    setup().catch((e) => {
      console.error('Call setup error:', e);
      if (mounted) hangup();
    });

    // Listen for signaling messages
    const unsub = socket.onMessage(async (msg) => {
      if (msg.from !== contact) return;

      if (msg.type === 'call_answer' && pcRef.current) {
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription(JSON.parse(msg.sdp)),
        );
        // Process queued ICE candidates
        for (const c of iceCandidatesQueue.current) {
          await pcRef.current.addIceCandidate(c);
        }
        iceCandidatesQueue.current = [];
      } else if (msg.type === 'call_ice') {
        const candidate = new RTCIceCandidate(JSON.parse(msg.candidate));
        if (pcRef.current?.remoteDescription) {
          await pcRef.current.addIceCandidate(candidate);
        } else {
          iceCandidatesQueue.current.push(candidate);
        }
      } else if (msg.type === 'call_hangup') {
        cleanup();
        if (mounted) {
          setCallState('ended');
          setTimeout(() => navigation.goBack(), 500);
        }
      }
    });

    return () => {
      mounted = false;
      unsub();
      cleanup();
    };
  }, [contact, incoming, incomingSdp, hangup, cleanup, navigation]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {contact[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>@{contact}</Text>
        <Text style={styles.status}>
          {callState === 'connecting' && 'Connecting...'}
          {callState === 'ringing' && 'Ringing...'}
          {callState === 'active' && formatDuration(duration)}
          {callState === 'ended' && 'Call ended'}
        </Text>
      </View>

      <TouchableOpacity style={styles.hangupBtn} onPress={hangup}>
        <Text style={styles.hangupText}>End</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 80,
  },
  info: {alignItems: 'center'},
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {color: '#fff', fontSize: 40, fontWeight: 'bold'},
  name: {color: '#fff', fontSize: 24, fontWeight: '600'},
  status: {color: '#888', fontSize: 16, marginTop: 8},
  hangupBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangupText: {color: '#fff', fontSize: 16, fontWeight: '600'},
});
