import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SalesProgressProps {
  storeId?: number;
}

export default function SalesProgress({ storeId }: SalesProgressProps) {
  const [selectedMonth, setSelectedMonth] = useState('current');
  
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['/api/salesplan', selectedMonth, storeId],
  });
  
  if (isLoading) {
    return (
      <Card className="bg-white mb-8">
        <CardContent className="p-6">
          <div className="h-48 animate-pulse bg-gray-200 rounded-md" />
        </CardContent>
      </Card>
    );
  }
  
  const months = [
    { value: 'current', label: 'Lipiec 2023' },
    { value: 'previous', label: 'Czerwiec 2023' },
    { value: 'previous2', label: 'Maj 2023' }
  ];
  
  const storeData = [
    {
      name: 'Sklep Santocka 39',
      progress: 75,
      current: '56,250 zł',
      total: '75,000 zł'
    },
    {
      name: 'Sklep Struga 31A',
      progress: 62,
      current: '68,200 zł',
      total: '110,000 zł'
    }
  ];
  
  return (
    <Card className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Realizacja planu sprzedaży - {months.find(m => m.value === selectedMonth)?.label}
        </h2>
        <div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="bg-gray-100 border border-gray-300 text-sm rounded-md py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 w-[160px]">
              <SelectValue placeholder="Wybierz miesiąc" />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        {storeData.map((store, index) => (
          <div key={index}>
            <div className="flex justify-between mb-2">
              <div className="font-medium">{store.name}</div>
              <div className="text-sm font-medium">{store.progress}% planu</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-primary-600 h-4 rounded-full" 
                style={{ width: `${store.progress}%` }}
              ></div>
            </div>
            <div className="mt-2 grid grid-cols-2 text-sm">
              <div>
                <span className="text-gray-500">Aktualnie:</span>
                <span className="font-medium ml-1">{store.current}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-500">Plan:</span>
                <span className="font-medium ml-1">{store.total}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
