import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye } from 'lucide-react';
import { Order } from '@shared/schema';

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    // Znormalizowane statusy
    case 'nowe':
      return 'info';
    case 'zaplanowany':
      return 'warning';
    case 'w trakcie':
      return 'warning';
    case 'zakończony':
      return 'success';
    case 'reklamacja':
      return 'danger';
      
    // Dla kompatybilności ze starszymi statusami
    case 'złożone':
      return 'info';
    case 'transport wykonany':
      return 'info';
    case 'w realizacji':
      return 'warning';
    case 'zakończone':
      return 'success';
    case 'zafakturowane':
      return 'success';
    case 'montaż zaplanowany':
      return 'warning';
    case 'w trakcie montażu':
      return 'warning';
    case 'montaż wykonany':
      return 'success';
    case 'zlecenie złożone':
      return 'info';
    default:
      return 'neutral';
  }
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    // Znormalizowane statusy
    'nowe': 'Nowe',
    'zaplanowany': 'Zaplanowany',
    'w trakcie': 'W trakcie',
    'zakończony': 'Zakończony',
    'reklamacja': 'Reklamacja',
    
    // Dla kompatybilności ze starszymi statusami
    'złożone': 'Złożone',
    'transport wykonany': 'Transport wykonany',
    'w realizacji': 'W realizacji',
    'zakończone': 'Zakończone',
    'zafakturowane': 'Zafakturowane',
    'montaż zaplanowany': 'Zaplanowany',
    'w trakcie montażu': 'W trakcie',
    'montaż wykonany': 'Zakończony',
    'zlecenie złożone': 'Nowe'
  };
  
  return labels[status] || status;
};

export default function RecentOrders() {
  const [, setLocation] = useLocation();
  
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders/recent'],
  });
  
  const handleViewOrder = (id: number) => {
    setLocation(`/orders/${id}`);
  };
  
  const handleViewAllOrders = () => {
    setLocation('/orders');
  };
  
  if (isLoading) {
    return (
      <Card className="bg-white shadow-sm border border-gray-200 mb-8">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <CardTitle className="font-semibold text-gray-800">Najnowsze zlecenia</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-64 animate-pulse bg-gray-100" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
      <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <CardTitle className="font-semibold text-gray-800">Najnowsze zlecenia</CardTitle>
          <Button 
            variant="link" 
            className="text-primary-600 hover:text-primary-800 text-sm font-medium p-0"
            onClick={handleViewAllOrders}
          >
            Zobacz wszystkie
          </Button>
        </div>
      </CardHeader>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nr zlecenia</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Klient</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usługa</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders?.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  #{order.orderNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {order.clientName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {order.serviceType}{order.withTransport ? ' + transport' : ''}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString('pl-PL')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {order.companyName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={getStatusBadgeVariant(order.installationStatus || '')}>
                    {getStatusLabel(order.installationStatus || '')}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-primary-600 hover:text-primary-900 h-8 w-8"
                      onClick={() => handleViewOrder(order.id)}
                    >
                      <Eye className="h-5 w-5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
