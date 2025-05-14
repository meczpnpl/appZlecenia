import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ClipboardList, Clock, CheckCircle, AlertTriangle } from "lucide-react";

interface StatsProps {
  storeId?: number;
}

export default function Stats({ storeId }: StatsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/stats', storeId],
  });

  if (isLoading) {
    return (
      <div className="grid gap-6 mb-8 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-white">
            <CardContent className="p-4">
              <div className="h-24 animate-pulse bg-gray-200 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Nowe zlecenia",
      value: stats?.newOrders || 0,
      icon: <ClipboardList className="h-8 w-8" />,
      iconBg: "bg-primary-100 text-primary-800",
      change: { value: "8%", text: "Wzrost o 8% w porównaniu do zeszłego tygodnia", icon: <ArrowUp className="h-4 w-4 mr-1" /> },
      changeColor: "text-green-600"
    },
    {
      title: "Zakończone",
      value: stats?.completedOrders || 0,
      icon: <CheckCircle className="h-8 w-8" />,
      iconBg: "bg-green-100 text-green-800",
      change: { value: "12%", text: "Wzrost o 12% w porównaniu do zeszłego miesiąca", icon: <ArrowUp className="h-4 w-4 mr-1" /> },
      changeColor: "text-green-600"
    },
    {
      title: "W realizacji",
      value: stats?.inProgressOrders || 0,
      icon: <Clock className="h-8 w-8" />,
      iconBg: "bg-orange-100 text-orange-800",
      change: { value: "", text: "Opóźnienia serwisu: 2 zlecenia", icon: null },
      changeColor: "text-orange-600"
    },
    {
      title: "Reklamacje",
      value: stats?.complaints || 0,
      icon: <AlertTriangle className="h-8 w-8" />,
      iconBg: "bg-red-100 text-red-800",
      change: { value: "", text: "Wymagane działanie: 1 pilna", icon: <AlertTriangle className="h-4 w-4 mr-1" /> },
      changeColor: "text-red-600"
    }
  ];

  return (
    <div className="grid gap-6 mb-8 md:grid-cols-2 xl:grid-cols-4">
      {statCards.map((stat, i) => (
        <Card key={i} className="bg-white shadow-sm border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${stat.iconBg}`}>
                {stat.icon}
              </div>
              <div className="ml-4">
                <h2 className="font-semibold text-gray-400 text-sm">{stat.title}</h2>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
            <div className={`mt-4 text-sm flex items-center ${stat.changeColor}`}>
              {stat.change.icon}
              <span>{stat.change.text}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
