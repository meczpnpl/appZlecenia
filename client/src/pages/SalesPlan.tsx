import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackButton } from '@/components/ui/back-button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Edit, Save, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { SalesPlan } from '@shared/schema';

export default function SalesPlanPage() {
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [editMode, setEditMode] = useState(false);
  
  const { data: salesPlanData, isLoading } = useQuery<SalesPlan>({
    queryKey: ['/api/salesplan', { year, month }],
  });
  
  const handleToggleEditMode = () => {
    setEditMode(!editMode);
  };
  
  const handleSave = () => {
    // Logic to save updated plan values
    setEditMode(false);
  };
  
  if (isLoading) {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="animate-pulse h-8 w-64 bg-gray-200 rounded"></div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-96 animate-pulse bg-gray-100 rounded-md"></div>
        </CardContent>
      </Card>
    );
  }
  
  // Ensure only admin and workers can access this page
  if (user?.role !== 'admin' && user?.role !== 'worker') {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <CardTitle className="font-semibold text-gray-800">Brak dostępu</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-600">Nie masz uprawnień do wyświetlania planów sprzedaży.</p>
        </CardContent>
      </Card>
    );
  }
  
  const months = [
    { value: '1', label: 'Styczeń' },
    { value: '2', label: 'Luty' },
    { value: '3', label: 'Marzec' },
    { value: '4', label: 'Kwiecień' },
    { value: '5', label: 'Maj' },
    { value: '6', label: 'Czerwiec' },
    { value: '7', label: 'Lipiec' },
    { value: '8', label: 'Sierpień' },
    { value: '9', label: 'Wrzesień' },
    { value: '10', label: 'Październik' },
    { value: '11', label: 'Listopad' },
    { value: '12', label: 'Grudzień' }
  ];
  
  const years = ['2022', '2023', '2024', '2025'];
  
  // Define the chart data type
  type ChartDataType = {
    name: string;
    plan: number;
    actual: number;
    orderProfit: number;
    salesProfit: number;
  };
  
  // Empty chart data
  const chartData: ChartDataType[] = [];
  
  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <BackButton fallbackPath="/" className="mb-4" />
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="font-semibold text-gray-800">
              Plan sprzedaży
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <div className="flex gap-2 items-center">
                <Calendar className="h-4 w-4 text-gray-500" />
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Wybierz miesiąc" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Rok" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Edit mode toggle button - only for admins and store managers */}
              {(user?.role === 'admin' || (user?.role === 'worker' && (user?.position === 'kierownik' || user?.position === 'zastępca'))) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={editMode ? handleSave : handleToggleEditMode}
                >
                  {editMode ? (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Zapisz
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Edytuj
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="mb-8">
            <h3 className="font-medium text-lg mb-6">Graficzna realizacja planu</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value.toLocaleString()} zł`} />
                  <Legend />
                  <Bar dataKey="plan" name="Plan" fill="#4338ca" />
                  <Bar dataKey="actual" name="Realizacja" fill="#3b82f6" />
                  <Bar dataKey="orderProfit" name="Zysk ze zleceń" fill="#10b981" />
                  <Bar dataKey="salesProfit" name="Zysk ze sprzedaży" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-lg mb-4">Szczegółowe zestawienie</h3>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sklep</TableHead>
                  <TableHead className="text-right">Plan miesięczny</TableHead>
                  <TableHead className="text-right">Aktualna realizacja</TableHead>
                  <TableHead className="text-right">Sprzedaż produktów netto</TableHead>
                  <TableHead className="text-right">Zysk ze zleceń</TableHead>
                  <TableHead className="text-right">% wykonania planu</TableHead>
                  <TableHead className="text-right">Prognoza</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Brak danych w planie sprzedaży. Użyj przycisku "Edytuj", aby dodać nowe dane.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Manual Updates Section */}
      {editMode && (
        <Card className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <CardTitle className="font-semibold text-gray-800">
              Ręczna aktualizacja danych
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-4">Sklep Santocka 39</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wartość sprzedaży produktów netto
                    </label>
                    <Input defaultValue="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dane z systemu księgowego
                    </label>
                    <Input defaultValue="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Uwagi do planu
                    </label>
                    <Input defaultValue="" />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-4">Sklep Struga 31A</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wartość sprzedaży produktów netto
                    </label>
                    <Input defaultValue="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dane z systemu księgowego
                    </label>
                    <Input defaultValue="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Uwagi do planu
                    </label>
                    <Input defaultValue="" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Zapisz zmiany
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
