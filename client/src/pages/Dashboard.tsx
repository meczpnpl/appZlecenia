import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { BarChart3, ClipboardCheck, Truck, DollarSign, Calendar, Clock, CheckCircle, X, AlertTriangle, Store } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Order } from '@shared/schema';
import { useLocation } from 'wouter';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  interface StatsData {
    totalOrders: string;
    pendingOrders: string;
    completedOrders: string;
    totalRevenue: string;
  }
  
  const { data: stats, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ['/api/stats', user?.storeId],
    enabled: !!user,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity
  });
  
  const { data: recentOrders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders/recent'],
    enabled: !!user,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity
  });
  
  const navigateToOrders = () => {
    setLocation('/orders');
  };
  
  const navigateToSalesPlan = () => {
    setLocation('/salesplan');
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Panel Główny</h1>
        <div className="text-sm text-gray-500">
          {user?.role === 'worker' && (
            <div className="flex items-center">
              <Store size={16} className="mr-1" />
              <span>{user.store || 'Nie przypisano do sklepu'}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Wszystkie zlecenia" 
          value={statsLoading ? '...' : stats?.totalOrders || '0'} 
          description="Łącznie zlecenia" 
          icon={<ClipboardCheck className="h-5 w-5 text-blue-500" />}
          color="blue"
        />
        <StatCard 
          title="Oczekujące" 
          value={statsLoading ? '...' : stats?.pendingOrders || '0'} 
          description="Zlecenia w toku" 
          icon={<Clock className="h-5 w-5 text-yellow-500" />}
          color="yellow"
        />
        <StatCard 
          title="Zakończone" 
          value={statsLoading ? '...' : stats?.completedOrders || '0'} 
          description="W tym miesiącu" 
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          color="green"
        />
        <StatCard 
          title="Przychód" 
          value={statsLoading ? '...' : `${stats?.totalRevenue || '0'} zł`} 
          description="Szacowany zysk" 
          icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
          color="emerald"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle>Ostatnie Zlecenia</CardTitle>
              <Button variant="outline" size="sm" onClick={navigateToOrders}>
                Zobacz wszystkie
              </Button>
            </div>
            <CardDescription>Najnowsze zlecenia montażu</CardDescription>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="flex justify-center p-6">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              </div>
            ) : recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-4">
                {recentOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-start space-x-3">
                      <div className={`rounded-full p-2 ${
                        order.installationStatus === 'zakończone' || order.installationStatus === 'zafakturowane' 
                          ? 'bg-green-100' 
                          : order.installationStatus === 'w realizacji' 
                            ? 'bg-yellow-100' 
                            : order.installationStatus === 'reklamacja' || order.installationStatus === 'Reklamacja'
                              ? 'bg-red-100' 
                              : 'bg-blue-100'
                      }`}>
                        {order.installationStatus === 'zakończone' || order.installationStatus === 'zafakturowane' 
                          ? <CheckCircle size={16} className="text-green-600" />
                          : order.installationStatus === 'w realizacji' 
                            ? <Clock size={16} className="text-yellow-600" />
                            : order.installationStatus === 'reklamacja' || order.installationStatus === 'Reklamacja'
                              ? <AlertTriangle size={16} className="text-red-600" />
                              : order.transportStatus === 'transport dostarczony'
                                ? <Truck size={16} className="text-blue-600" />
                                : <ClipboardCheck size={16} className="text-blue-600" />
                        }
                      </div>
                      <div>
                        <div className="font-medium">{order.clientName}</div>
                        <div className="text-sm text-gray-500">{order.serviceType}</div>
                      </div>
                    </div>
                    <div className="text-sm text-right">
                      <div>{formatDate(order.createdAt)}</div>
                      <div className={`
                        ${order.installationStatus === 'zakończone' || order.installationStatus === 'zafakturowane' 
                          ? 'text-green-600' 
                          : order.installationStatus === 'w realizacji' 
                            ? 'text-yellow-600' 
                            : order.installationStatus === 'reklamacja' || order.installationStatus === 'Reklamacja'
                              ? 'text-red-600' 
                              : 'text-blue-600'
                        }
                      `}>
                        {order.installationStatus}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                Brak ostatnich zleceń do wyświetlenia
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Quick Actions / Plan Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Przydatne Akcje</CardTitle>
            <CardDescription>Szybki dostęp do najczęściej używanych funkcji</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button className="w-full justify-start py-6" onClick={navigateToOrders}>
                <ClipboardCheck className="h-5 w-5 mr-2" />
                Nowe zlecenie
              </Button>
              
              <Button className="w-full justify-start py-6" variant="outline" onClick={navigateToOrders}>
                <Truck className="h-5 w-5 mr-2" />
                Zarządzaj transportem 
              </Button>
              
              {(user?.role === 'admin' || user?.role === 'worker') && (
                <>
                  <Button className="w-full justify-start py-6" variant="outline" onClick={navigateToSalesPlan}>
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Plan sprzedaży
                  </Button>
                  
                  <Button className="w-full justify-start py-6" variant="outline">
                    <Calendar className="h-5 w-5 mr-2" />
                    Planowanie
                  </Button>
                </>
              )}
            </div>
            
            {/* Plan Progress */}
            {(user?.role === 'admin' || user?.role === 'worker') && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold mb-2">Plan sprzedaży</h3>
                <div className="text-center py-3 text-gray-500">
                  Brak danych - dodaj dane planu sprzedaży w sekcji "Plan sprzedaży"
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  description, 
  icon,
  color = 'blue'
}: { 
  title: string, 
  value: string, 
  description: string, 
  icon: React.ReactNode,
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'emerald'
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
    emerald: 'bg-emerald-50 border-emerald-200'
  };
  
  return (
    <div className={`p-6 rounded-lg shadow-sm border ${colors[color]}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <div className="rounded-full p-2 bg-white">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}
