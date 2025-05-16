import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/back-button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarDays, 
  Phone,
  Calendar,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  Eye,
  Hammer
} from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';

// Badge variants based on status
function getStatusBadgeVariant(status: string) {
  switch (status?.toLowerCase()) {
    case 'nowe':
    case 'gotowe do transportu':
      return 'secondary';
    case 'montaż zaplanowany':
    case 'transport zaplanowany':
      return 'warning';
    case 'w trakcie montażu':
      return 'default';
    case 'montaż wykonany':
    case 'transport dostarczony':
      return 'success';
    case 'reklamacja':
      return 'destructive';
    default:
      return 'secondary';
  }
}

// Get status label in Polish
function getStatusLabel(status: string) {
  if (!status) return 'Nieznany';
  
  switch(status.toLowerCase()) {
    case 'nowe': return 'Nowe';
    case 'montaż zaplanowany': return 'Zaplanowany';
    case 'w trakcie montażu': return 'W trakcie';
    case 'montaż wykonany': return 'Zakończony';
    case 'reklamacja': return 'Reklamacja';
    case 'gotowe do transportu': return 'Skompletowany';
    case 'transport zaplanowany': return 'Zaplanowany';
    case 'transport dostarczony': return 'Dostarczony';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export default function InstallerSchedule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Dynamically calculate start of week
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday as first day
  
  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  
  // Pobierz zlecenia dla montażysty lub firmy (niezależnie czy jednoosobowej czy z pracownikami)
  // Ujednolicony interfejs dla wszystkich typów firm
  const { data: installerOrders = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/orders'],
    enabled: !!user?.id
  });
  
  const handlePrevWeek = () => {
    setCurrentDate(subWeeks(currentDate, 1));
  };
  
  const handleNextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1));
  };
  
  const handleToday = () => {
    setCurrentDate(new Date());
  };
  
  const handleViewOrder = (orderId: number) => {
    setLocation(`/orders/${orderId}`);
  };

  // Filter orders for the current week
  // Ujednolicone filtrowanie zleceń niezależnie od typu firmy (jednoosobowa czy z pracownikami)
  const ordersForWeek = installerOrders.filter(order => {
    if (!order.installationDate) return false;
    const orderDate = new Date(order.installationDate);
    // Check if it's in the current week
    return orderDate >= startDate && orderDate < addDays(startDate, 7);
  });
  
  // Group orders by day
  const ordersByDay = weekDays.map(day => {
    return {
      date: day,
      orders: ordersForWeek.filter(order => {
        const orderDate = new Date(order.installationDate);
        return isSameDay(orderDate, day);
      })
    };
  });

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <BackButton fallbackPath="/" className="mb-4" />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold">Harmonogram Prac</CardTitle>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleToday}
            >
              Dzisiaj
            </Button>
            <div className="flex">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handlePrevWeek}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleNextWeek}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <h3 className="text-lg font-medium text-gray-700">
              {format(startDate, 'dd MMMM', { locale: pl })} - {format(addDays(startDate, 6), 'dd MMMM yyyy', { locale: pl })}
            </h3>
          </div>
          
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col space-y-2">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {ordersByDay.map((dayData, index) => (
                <div key={index} className="border rounded-md p-4">
                  <h3 className="font-medium text-lg mb-4 flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-gray-500" />
                    {format(dayData.date, 'EEEE, d MMMM', { locale: pl })}
                    {isSameDay(dayData.date, new Date()) && (
                      <Badge variant="secondary" className="ml-2">Dzisiaj</Badge>
                    )}
                  </h3>
                  
                  {dayData.orders.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <CalendarDays className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                      <p>Brak zaplanowanych prac na ten dzień</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dayData.orders.map((order: any) => (
                        <div 
                          key={order.id} 
                          className="border p-4 rounded-md shadow-sm hover:shadow-md transition-shadow cursor-pointer relative group"
                          onClick={() => handleViewOrder(order.id)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium">{order.orderNumber}</div>
                              <div className="text-sm text-gray-500">{order.clientName}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant={getStatusBadgeVariant(order.installationStatus)}>
                                <Hammer className="h-3 w-3 mr-1" />
                                {getStatusLabel(order.installationStatus)}
                              </Badge>
                              {order.transportStatus && (
                                <Badge variant={getStatusBadgeVariant(order.transportStatus)}>
                                  <Truck className="h-3 w-3 mr-1" />
                                  {getStatusLabel(order.transportStatus)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                            <div className="flex items-center text-sm">
                              <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                              <span className="truncate" title={order.installationAddress}>
                                {order.installationAddress}
                              </span>
                            </div>
                            
                            <div className="flex items-center text-sm">
                              <Package className="h-4 w-4 mr-2 text-gray-400" />
                              <span>{order.serviceType}</span>
                            </div>
                            
                            <div className="flex items-center text-sm">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              <a 
                                href={`tel:${order.clientPhone}`}
                                className="text-primary-600 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {order.clientPhone}
                              </a>
                            </div>
                          </div>
                          
                          <div className="flex justify-end mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 py-1 opacity-70 hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewOrder(order.id);
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Szczegóły
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}