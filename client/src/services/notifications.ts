import notifee, {AndroidImportance} from '@notifee/react-native';

const CHANNEL_ID = 'sos-messages';
const SERVICE_CHANNEL_ID = 'sos-service';

export async function setupChannels() {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Messages',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
  await notifee.createChannel({
    id: SERVICE_CHANNEL_ID,
    name: 'Background Service',
    importance: AndroidImportance.LOW,
  });
}

export async function showMessageNotification(
  from: string,
  text: string,
) {
  await notifee.displayNotification({
    title: `@${from}`,
    body: text,
    android: {
      channelId: CHANNEL_ID,
      pressAction: {id: 'default'},
      smallIcon: 'ic_launcher',
    },
  });
}

export async function showCallNotification(from: string) {
  await notifee.displayNotification({
    title: 'Incoming call',
    body: `@${from} is calling`,
    android: {
      channelId: CHANNEL_ID,
      pressAction: {id: 'default'},
      smallIcon: 'ic_launcher',
      importance: AndroidImportance.HIGH,
    },
  });
}

export {SERVICE_CHANNEL_ID};
