import { useState } from 'react';
import { useNotifications } from '@/hooks/use-notifications';
import { Bell, X, BellOff, CheckCheck, Menu, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('notifications');
  const { 
    status, 
    isSubscribed, 
    hasNewNotifications,
    notificationCount,
    notificationsList, 
    subscribe, 
    unsubscribe,
    requestPermission,
    markAllAsRead,
    markAsRead,
    deleteNotification,
    fetchNotifications
  } = useNotifications();
  const [, navigate] = useLocation();

  const handleClick = () => {
    if (!open) {
      fetchNotifications();
    }
    setOpen(!open);
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.url) {
      navigate(notification.url);
    }
    setOpen(false);
  };

  const toggleSubscription = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative" 
          onClick={handleClick}
          aria-label="Powiadomienia"
        >
          <Bell className="h-5 w-5" />
          {hasNewNotifications && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="end">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between p-4 border-b">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="notifications">Powiadomienia</TabsTrigger>
              <TabsTrigger value="settings">Ustawienia</TabsTrigger>
            </TabsList>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <TabsContent value="notifications" className="p-0 focus:outline-none">
            <div className="flex items-center justify-between p-2 bg-muted/50">
              <div className="text-sm font-medium">Powiadomienia</div>
              {notificationsList.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => markAllAsRead()}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Oznacz wszystkie jako przeczytane
                </Button>
              )}
            </div>
            
            <div className="max-h-[300px] overflow-y-auto">
              {notificationsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <BellOff className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nie masz żadnych powiadomień</p>
                </div>
              ) : (
                <div>
                  {notificationsList.map((notification: any) => (
                    <div 
                      key={notification.id} 
                      className={`
                        p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors
                        ${!notification.read ? 'bg-blue-50/50' : ''}
                      `}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start space-x-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{notification.title}</p>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(notification.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="mt-1 flex items-center justify-between">
                            {notification.url && (
                              <div className="flex items-center text-xs text-primary">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Otwórz
                              </div>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Usuń
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="p-4 focus:outline-none space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-1">Powiadomienia push</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Otrzymuj powiadomienia push nawet gdy przeglądarka jest zamknięta.
              </p>
              
              <div className="flex items-center space-x-2 mt-3">
                <Switch
                  id="push-notifications"
                  checked={isSubscribed}
                  onCheckedChange={toggleSubscription}
                  disabled={status === 'denied' || status === 'unsupported'}
                />
                <Label htmlFor="push-notifications">
                  {status === 'denied' 
                    ? 'Powiadomienia zablokowane w przeglądarce' 
                    : status === 'unsupported' 
                    ? 'Twoja przeglądarka nie obsługuje powiadomień'
                    : isSubscribed 
                    ? 'Powiadomienia włączone' 
                    : 'Włącz powiadomienia push'}
                </Label>
              </div>
              
              {/* Pokaż przycisk do włączenia powiadomień, jeśli nie są subskrybowane */}
              {!isSubscribed && status === 'granted' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={subscribe}
                >
                  Zarejestruj powiadomienia
                </Button>
              )}
              
              {/* Pokaż przycisk do wyłączenia powiadomień, jeśli są subskrybowane */}
              {isSubscribed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={unsubscribe}
                >
                  Wyłącz powiadomienia
                </Button>
              )}
              
              {/* Pokaż przycisk do prośby o pozwolenie, jeśli status jest default */}
              {status === 'default' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={requestPermission}
                >
                  Poproś o pozwolenie
                </Button>
              )}
              
              {status === 'denied' && (
                <p className="text-xs text-destructive mt-2">
                  Zmień ustawienia powiadomień w ustawieniach przeglądarki, aby otrzymywać powiadomienia.
                </p>
              )}
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-1">Rodzaje powiadomień</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Nowe zlecenia</p>
                    <p className="text-xs text-muted-foreground">Powiadomienia o nowych zleceniach</p>
                  </div>
                  <Switch id="new-orders" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Aktualizacje zleceń</p>
                    <p className="text-xs text-muted-foreground">Powiadomienia o zmianach statusu zleceń</p>
                  </div>
                  <Switch id="order-updates" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Komunikacja</p>
                    <p className="text-xs text-muted-foreground">Wiadomości od innych użytkowników</p>
                  </div>
                  <Switch id="communication" defaultChecked />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'order':
      return <Menu className="h-4 w-4 text-primary" />;
    default:
      return <Bell className="h-4 w-4 text-primary" />;
  }
}

function formatDate(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Dla powiadomień starszych niż 24h pokaż datę
    if (diff > 24 * 60 * 60 * 1000) {
      return format(date, 'dd MMM', { locale: pl });
    }
    
    // Dla powiadomień z dzisiaj pokaż godzinę
    return format(date, 'HH:mm');
  } catch (e) {
    return '';
  }
}