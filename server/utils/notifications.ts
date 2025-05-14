import { Subscription } from "@shared/schema";
import nodemailer from "nodemailer";
import webpush from "web-push";
import { storage } from "../storage";

// VAPID konfiguracja zostanie ustawiona dynamicznie przed wysłaniem powiadomienia
// Nie ustawiamy tu statycznych kluczy, aby uniknąć konfliktów z ustawieniami z bazy danych

// Configure nodemailer for email sending with nazwa.pl SMTP server
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.ligazzpn.pl', // Pełna nazwa serwera SMTP nazwa.pl
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true' || false,
  auth: {
    user: process.env.SMTP_USER || 'info@ligazzpn.pl',
    pass: process.env.SMTP_PASS || 'ToM@01111965'
  },
  tls: {
    // Nie weryfikuj certyfikatu - przydatne dla testowania
    rejectUnauthorized: false
  },
  debug: true // Włącz debugowanie, aby zobaczyć więcej szczegółów w logach
});

/**
 * Send a push notification to a subscription
 */
export async function sendPushNotification(
  subscription: Subscription, 
  payload: { title: string; body: string; data?: any }
) {
  try {
    console.log('Próba wysłania powiadomienia push');
    
    // Pobierz klucze VAPID z bazy danych
    const vapidPublicKey = await storage.getSetting("vapid_public_key");
    const vapidPrivateKey = await storage.getSetting("vapid_private_key");
    
    // Sprawdź, czy klucze istnieją
    if (!vapidPublicKey?.value || !vapidPrivateKey?.value) {
      console.error('Brak kluczy VAPID w bazie danych');
      return false;
    }
    
    // Ustaw klucze VAPID
    const contactEmail = await storage.getSetting("contact_email");
    const emailContact = contactEmail?.value || 'info@ligazzpn.pl';
    
    // Ustaw konfigurację VAPID przed każdym wysłaniem
    webpush.setVapidDetails(
      `mailto:${emailContact}`,
      vapidPublicKey.value as string,
      vapidPrivateKey.value as string
    );
    
    // Przygotuj endpoint z prawidłowym formatem
    let endpoint = subscription.endpoint;
    
    // Konwertuj format z fcm/send/ na wp/ jeśli to konieczne
    if (endpoint && endpoint.includes('fcm.googleapis.com/fcm/send/')) {
      endpoint = endpoint.replace(
        'https://fcm.googleapis.com/fcm/send/', 
        'https://fcm.googleapis.com/wp/'
      );
      console.log('Naprawiono format endpointu FCM:', endpoint);
    }
    
    // Format the subscription object for web-push
    const pushSubscription = {
      endpoint: endpoint,
      keys: subscription.keys as { p256dh: string; auth: string }
    };

    // Send the notification
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        data: payload.data || {}
      })
    );

    console.log('Powiadomienie push wysłane pomyślnie');
    return true;
  } catch (error) {
    console.error('Błąd podczas wysyłania powiadomienia push:', error);
    // Nie rzucaj wyjątku, aby nie przerwać działania aplikacji
    return false;
  }
}

/**
 * Send an email notification
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
) {
  try {
    console.log('Próba wysłania e-mail do:', to);
    
    // Zawsze próbuj wysłać e-mail
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Bel-Pol System" <info@ligazzpn.pl>',
      to,
      subject,
      text,
      html: html || text
    });

    console.log('Email wysłany pomyślnie:', info.messageId);
    return true;
  } catch (error) {
    console.error('Błąd podczas wysyłania e-mail:', error);
    // Nie rzucaj wyjątku, aby nie przerwać działania aplikacji w przypadku błędu SMTP
    return false;
  }
}

/**
 * Send both email and push notification (if subscription exists)
 */
export async function sendNotification(
  email: string,
  subscription: Subscription | null,
  title: string,
  message: string,
  data?: any
) {
  try {
    console.log('Wysyłanie powiadomień do:', email);
    const results = {
      email: false,
      push: false
    };
    
    // Wysyłanie e-mail
    results.email = await sendEmail(email, title, message);

    // Wysyłanie powiadomienia push, jeśli subskrypcja istnieje
    if (subscription) {
      results.push = await sendPushNotification(subscription, {
        title,
        body: message,
        data
      });
    }
    
    return results;
  } catch (error) {
    console.error('Błąd podczas wysyłania powiadomień:', error);
    return {
      email: false,
      push: false,
      error: error instanceof Error ? error.message : 'Nieznany błąd'
    };
  }
}
