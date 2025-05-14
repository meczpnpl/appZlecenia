import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from 'wouter';
import { Company } from '@shared/schema';

// Rozszerzenie typu Company o dodatkowe dane z API
interface CompanyWithPerformance extends Company {
  completedOrders: number;
  totalOrders: number;
  timelinessPercent: number;
  complaintsPercent: number;
  lastOrderDate: string | Date;
}

interface CompanyPerformanceProps {
  limit?: number;
}

export default function CompanyPerformance({ limit }: CompanyPerformanceProps) {
  const [, setLocation] = useLocation();
  
  const { data: companies, isLoading } = useQuery<CompanyWithPerformance[]>({
    queryKey: ['/api/companies/performance', limit],
  });
  
  if (isLoading) {
    return (
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <CardTitle className="font-semibold text-gray-800">Wydajność firm montażowych</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-64 animate-pulse bg-gray-100 rounded-md" />
        </CardContent>
      </Card>
    );
  }
  
  const companyCards = companies || [
    {
      id: 1,
      name: "Drzwi-Mont s.c.",
      services: "Montaż drzwi, Transport",
      status: "active",
      completedOrders: 18,
      totalOrders: 20,
      timelinessPercent: 95,
      complaintsPercent: 5,
      lastOrderDate: "2023-07-12"
    },
    {
      id: 2,
      name: "Podłogi Expert",
      services: "Montaż podłogi",
      status: "active",
      completedOrders: 12,
      totalOrders: 15,
      timelinessPercent: 87,
      complaintsPercent: 3,
      lastOrderDate: "2023-07-11"
    },
    {
      id: 3,
      name: "TransExpress",
      services: "Transport",
      status: "active",
      completedOrders: 24,
      totalOrders: 26,
      timelinessPercent: 98,
      complaintsPercent: 1,
      lastOrderDate: "2023-07-09"
    }
  ];
  
  const handleViewCompanyDetails = (id: number) => {
    // Navigate to company details page when implemented
    setLocation(`/companies/${id}`);
  };
  
  return (
    <Card className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <CardTitle className="font-semibold text-gray-800">Wydajność firm montażowych</CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companyCards.map((company) => (
            <div key={company.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-medium text-lg">{company.name}</h3>
                  <p className="text-sm text-gray-500">
                    {Array.isArray(company.services) 
                      ? company.services.join(', ') 
                      : typeof company.services === 'string' 
                        ? company.services 
                        : 'Brak usług'}
                  </p>
                </div>
                <Badge variant="success">Aktywny</Badge>
              </div>
              
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Ukończone zlecenia</span>
                    <span className="font-medium">{company.completedOrders} / {company.totalOrders}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary-600 h-2.5 rounded-full" 
                      style={{ width: `${(company.completedOrders / company.totalOrders) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Terminowość</span>
                    <span className="font-medium">{company.timelinessPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-green-500 h-2.5 rounded-full" 
                      style={{ width: `${company.timelinessPercent}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Reklamacje</span>
                    <span className="font-medium">{company.complaintsPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-red-500 h-2.5 rounded-full" 
                      style={{ width: `${company.complaintsPercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  Ostatnie zlecenie: {new Date(company.lastOrderDate).toLocaleDateString('pl-PL')}
                </span>
                <Button 
                  variant="link" 
                  className="text-primary-600 hover:text-primary-800 text-sm font-medium p-0"
                  onClick={() => handleViewCompanyDetails(company.id)}
                >
                  Szczegóły
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
