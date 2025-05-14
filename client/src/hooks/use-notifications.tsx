import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';

type NotificationStatus = 'default' | 'granted' | 'denied' | 'unsupported';

interface UseNotificationsResult {
  status: NotificationStatus;
  isSubscribed: boolean;
  hasNewNotifications: boolean;
  notificationCount: number;
  notificationsList: any[];
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  markAllAsRead: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  fetchNotifications: () => Promise<void>;
}

export const useNotifications = (): UseNotificationsResult => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [status, setStatus] = useState<NotificationStatus>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [hasNewNotifications, setHasNewNotifications] = useState<boolean>(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Sprawdź, czy przeglądarka obsługuje powiadomienia
  useEffect(() => {
    if (!('Notification' in window)) {
      setStatus('unsupported');
      return;
    }

    // Ustaw aktualny status powiadomień
    setStatus(Notification.permission as NotificationStatus);

    // Zarejestruj service worker (jeśli nie jest już zarejestrowany)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(async (registration) => {
        setSwRegistration(registration);
        
        try {
          // Sprawdź czy użytkownik jest już subskrybowany w przeglądarce
          const subscription = await registration.pushManager.getSubscription();
          
          if (!subscription) {
            setIsSubscribed(false);
            return;
          }
          
          // Sprawdź czy istnieje subskrypcja na serwerze
          if (user) {
            try {
              const response = await fetch('/api/notifications/vapid-public-key');
              if (response.status === 200) {
                // Jeśli możemy pobrać klucz VAPID, ustawiamy, że subskrypcja istnieje
                setIsSubscribed(true);
              } else {
                // W przeciwnym razie anulujemy subskrypcję w przeglądarce, aby zachować spójność
                await subscription.unsubscribe();
                setIsSubscribed(false);
              }
            } catch (error) {
              console.error('Błąd podczas sprawdzania subskrypcji:', error);
              setIsSubscribed(false);
            }
          }
        } catch (error) {
          console.error('Błąd podczas sprawdzania subskrypcji:', error);
          setIsSubscribed(false);
        }
      });
    }

    // Załaduj powiadomienia tylko przy pierwszym załadowaniu
    if (user && notificationsList.length === 0) {
      fetchNotifications();
    }
    
    // Dla autorefresh powiadomień można ustawić interwał z długim okresem 
    // zamiast stałego odpytywania
    const interval = setInterval(() => {
      if (user) {
        fetchNotifications();
      }
    }, 5 * 60 * 1000); // Sprawdź co 5 minut
    
    return () => clearInterval(interval);
  }, [user?.id]);

  // Pobierz powiadomienia z serwera
  const fetchNotifications = async (): Promise<void> => {
    if (!user) return;
    
    try {
      const response = await apiRequest('GET', '/api/notifications');
      
      if (response.ok) {
        const notifications = await response.json();
        setNotificationsList(notifications);
        
        // Sprawdź, czy są nowe nieprzeczytane powiadomienia
        const unreadCount = notifications.filter((n: any) => !n.read).length;
        setHasNewNotifications(unreadCount > 0);
      }
    } catch (error) {
      console.error("Błąd podczas pobierania powiadomień:", error);
    }
  };

  // Poproś o pozwolenie na powiadomienia
  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toast({
        title: "Niepowodzenie",
        description: "Twoja przeglądarka nie obsługuje powiadomień",
        variant: "destructive"
      });
      return false;
    }

    try {
      console.log("Sprawdzanie uprawnienia powiadomień, obecne:", Notification.permission);
      
      // Jeśli uprawnienie zostało już udzielone, nie musimy prosić ponownie
      if (Notification.permission === 'granted') {
        setStatus('granted');
        console.log("Uprawnienie już udzielone");
        
        // Wyświetl testowe powiadomienie natywne, aby sprawdzić czy działa
        try {
          if ('Notification' in window) {
            const notification = new Notification('Test powiadomień', {
              body: 'To jest testowe powiadomienie w przeglądarce',
              icon: '/logo192.png'
            });
            console.log("Wyświetlono testowe powiadomienie:", notification);
          }
        } catch (notifyError) {
          console.error("Błąd podczas wyświetlania testowego powiadomienia:", notifyError);
        }
        
        return true;
      }
      
      // Poproś o pozwolenie
      console.log("Proszenie o uprawnienie...");
      const permission = await Notification.requestPermission();
      console.log("Uzyskane uprawnienie:", permission);
      setStatus(permission as NotificationStatus);
      
      if (permission === 'granted') {
        toast({
          title: "Sukces",
          description: "Udzielono pozwolenia na powiadomienia",
        });
        
        // Wyświetl testowe powiadomienie natywne po udzieleniu zgody
        try {
          if ('Notification' in window) {
            const notification = new Notification('Test powiadomień', {
              body: 'To jest testowe powiadomienie w przeglądarce',
              icon: '/logo192.png'
            });
            console.log("Wyświetlono testowe powiadomienie:", notification);
          }
        } catch (notifyError) {
          console.error("Błąd podczas wyświetlania testowego powiadomienia:", notifyError);
        }
        
        return true;
      } else {
        toast({
          title: "Uwaga",
          description: "Odmówiono pozwolenia na powiadomienia. Zmień ustawienia przeglądarki, aby otrzymywać powiadomienia.",
          variant: "destructive"
        });
        return false;
      }
    } catch (error) {
      console.error("Błąd podczas prośby o pozwolenie:", error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas prośby o pozwolenie",
        variant: "destructive"
      });
      return false;
    }
  };

  // Subskrybuj powiadomienia push
  const subscribe = async (): Promise<boolean> => {
    if (!swRegistration) {
      toast({
        title: "Niepowodzenie",
        description: "Service Worker nie jest zarejestrowany",
        variant: "destructive"
      });
      return false;
    }

    try {
      // Najpierw poproś o pozwolenie, jeśli jest potrzebne
      if (Notification.permission !== 'granted') {
        const permissionGranted = await requestPermission();
        if (!permissionGranted) return false;
      }

      // Pobierz klucz publiczny VAPID
      const vapidPublicKeyResponse = await apiRequest('GET', '/api/notifications/vapid-public-key');
      if (!vapidPublicKeyResponse.ok) {
        throw new Error('Nie udało się pobrać klucza publicznego VAPID');
      }
      
      const { publicKey } = await vapidPublicKeyResponse.json();
      
      // Konwertuj klucz publiczny z base64 na Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // Subskrybuj Push Manager
      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      // Przygotuj subskrypcję do wysłania na serwer
      // Ensure the endpoint has the correct format for FCM
      const subscriptionObj = subscription.toJSON();
      
      // Convert from fcm/send/ format to wp/ format if needed
      if (subscriptionObj.endpoint && subscriptionObj.endpoint.includes('fcm.googleapis.com/fcm/send/')) {
        subscriptionObj.endpoint = subscriptionObj.endpoint.replace(
          'https://fcm.googleapis.com/fcm/send/', 
          'https://fcm.googleapis.com/wp/'
        );
        console.log('Fixed FCM endpoint format:', subscriptionObj.endpoint);
      }
      
      // Wyślij subskrypcję do serwera
      const response = await apiRequest('POST', '/api/notifications/subscribe', subscriptionObj);

      if (response.ok) {
        setIsSubscribed(true);
        toast({
          title: "Sukces",
          description: "Subskrybowano powiadomienia pomyślnie",
        });
        return true;
      } else {
        throw new Error('Nie udało się zapisać subskrypcji na serwerze');
      }
    } catch (error) {
      console.error('Błąd podczas subskrypcji:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas subskrypcji powiadomień",
        variant: "destructive"
      });
      return false;
    }
  };

  // Anuluj subskrypcję powiadomień push
  const unsubscribe = async (): Promise<boolean> => {
    if (!swRegistration) {
      return false;
    }

    try {
      const subscription = await swRegistration.pushManager.getSubscription();
      
      if (!subscription) {
        setIsSubscribed(false);
        return true;
      }

      // Anuluj subskrypcję w przeglądarce
      await subscription.unsubscribe();
      setIsSubscribed(false);
      
      try {
        // Próbujemy anulować subskrypcję na serwerze, ale nie blokujemy powodzenia,
        // jeśli to się nie uda (np. jeśli subskrypcja już nie istnieje na serwerze)
        const response = await apiRequest('DELETE', '/api/notifications/unsubscribe');
        console.log('Odpowiedź serwera przy anulowaniu subskrypcji:', response.status);
      } catch (serverError) {
        console.error('Błąd podczas anulowania subskrypcji na serwerze:', serverError);
        // Nie pokazujemy tego błędu użytkownikowi, bo subskrypcję udało się usunąć w przeglądarce
      }
      
      toast({
        title: "Sukces",
        description: "Anulowano subskrypcję powiadomień",
      });
      
      return true;
    } catch (error) {
      console.error('Błąd podczas anulowania subskrypcji:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas anulowania subskrypcji",
        variant: "destructive"
      });
      return false;
    }
  };

  // Oznacz wszystkie powiadomienia jako przeczytane
  const markAllAsRead = async (): Promise<void> => {
    try {
      const response = await apiRequest('PATCH', '/api/notifications/read-all');
      
      if (response.ok) {
        setNotificationsList(prev => prev.map(notif => ({ ...notif, read: true })));
        setHasNewNotifications(false);
        
        toast({
          title: "Sukces",
          description: "Wszystkie powiadomienia oznaczono jako przeczytane",
        });
      }
    } catch (error) {
      console.error('Błąd podczas oznaczania powiadomień jako przeczytane:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas aktualizacji powiadomień",
        variant: "destructive"
      });
    }
  };

  // Oznacz pojedyncze powiadomienie jako przeczytane
  const markAsRead = async (id: number): Promise<void> => {
    try {
      const response = await apiRequest('PATCH', `/api/notifications/${id}/read`);
      
      if (response.ok) {
        setNotificationsList(prev => 
          prev.map(notif => notif.id === id ? { ...notif, read: true } : notif)
        );
        
        // Sprawdź, czy są jeszcze nieprzeczytane powiadomienia
        const hasUnread = notificationsList.some(
          notif => notif.id !== id && !notif.read
        );
        
        setHasNewNotifications(hasUnread);
      }
    } catch (error) {
      console.error('Błąd podczas oznaczania powiadomienia jako przeczytane:', error);
    }
  };

  // Helper do konwersji klucza base64 do Uint8Array
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  };

  // Usuń powiadomienie
  const deleteNotification = async (id: number): Promise<void> => {
    try {
      const response = await apiRequest('DELETE', `/api/notifications/${id}`);
      
      if (response.ok) {
        setNotificationsList(prev => prev.filter(notif => notif.id !== id));
        
        // Przelicz ponownie ilość nieprzeczytanych wiadomości
        const hasUnread = notificationsList.some(
          notif => notif.id !== id && !notif.read
        );
        
        setHasNewNotifications(hasUnread);
        
        toast({
          title: "Sukces",
          description: "Powiadomienie zostało usunięte",
        });
      }
    } catch (error) {
      console.error('Błąd podczas usuwania powiadomienia:', error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas usuwania powiadomienia",
        variant: "destructive"
      });
    }
  };

  return {
    status,
    isSubscribed,
    hasNewNotifications,
    notificationCount: notificationsList.filter((n: any) => !n.read).length,
    notificationsList,
    subscribe,
    unsubscribe,
    requestPermission,
    markAllAsRead,
    markAsRead,
    deleteNotification,
    fetchNotifications,
  };
}