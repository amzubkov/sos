import nacl from 'tweetnacl';
import {
  encodeBase64,
  decodeBase64,
  encodeUTF8,
  decodeUTF8,
} from 'tweetnacl-util';

export interface KeyPair {
  publicKey: string; // base64
  secretKey: string; // base64
}

export function generateKeyPair(): KeyPair {
  const kp = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
  };
}

export function encrypt(
  plaintext: string,
  theirPublicKey: string,
  mySecretKey: string,
): {ciphertext: string; nonce: string} {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = decodeUTF8(plaintext);
  const theirPub = decodeBase64(theirPublicKey);
  const mySec = decodeBase64(mySecretKey);

  const encrypted = nacl.box(messageBytes, nonce, theirPub, mySec);
  if (!encrypted) {
    throw new Error('encryption failed');
  }

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

export function decrypt(
  ciphertext: string,
  nonce: string,
  theirPublicKey: string,
  mySecretKey: string,
): string {
  const decrypted = nacl.box.open(
    decodeBase64(ciphertext),
    decodeBase64(nonce),
    decodeBase64(theirPublicKey),
    decodeBase64(mySecretKey),
  );
  if (!decrypted) {
    throw new Error('decryption failed');
  }
  return encodeUTF8(decrypted);
}
