// Skrypt do generowania kluczy VAPID dla Web Push
import webpush from 'web-push';

// Generowanie kluczy VAPID
const vapidKeys = webpush.generateVAPIDKeys();

console.log('Klucze VAPID wygenerowane pomyślnie:');
console.log('==========================================');
console.log('Klucz publiczny VAPID:', vapidKeys.publicKey);
console.log('Klucz prywatny VAPID:', vapidKeys.privateKey);
console.log('==========================================');