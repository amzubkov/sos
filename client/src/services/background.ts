import BackgroundService from 'react-native-background-actions';
import {socket} from '../ws/socket';
import {getKey, getContact, saveContact, saveMessage} from '../db/database';
import {decrypt} from '../crypto/e2e';
import {WS_URL, SERVER_URL} from '../config';
import {
  setupChannels,
  showMessageNotification,
  showCallNotification,
} from './notifications';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const backgroundTask = async () => {
  await setupChannels();

  const token = await getKey('token');
  if (!token) return;

  // Connect WebSocket
  socket.connect(WS_URL, token);

  // Handle incoming messages in background
  socket.onMessage(async (msg: any) => {
    if (msg.type === 'chat' && msg.from) {
      try {
        const sk = await getKey('secretKey');
        if (!sk) return;

        let contact = await getContact(msg.from);
        if (!contact) {
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

        await showMessageNotification(msg.from, plaintext);
      } catch (e) {
        console.error('bg decrypt error:', e);
      }
    } else if (msg.type === 'call_offer' && msg.from) {
      await showCallNotification(msg.from);
    }
  });

  // Keep alive
  while (BackgroundService.isRunning()) {
    await sleep(30000);
  }
};

const options = {
  taskName: 'SOS',
  taskTitle: 'SOS Messenger',
  taskDesc: 'Connected',
  taskIcon: {name: 'ic_launcher', type: 'mipmap'},
  linkingURI: 'sos://',
  parameters: {delay: 30000},
};

export async function startBackgroundService() {
  if (!BackgroundService.isRunning()) {
    await BackgroundService.start(backgroundTask, options);
  }
}

export async function stopBackgroundService() {
  if (BackgroundService.isRunning()) {
    await BackgroundService.stop();
  }
}
