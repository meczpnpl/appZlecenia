import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from '@/components/ui/back-button';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from '@/components/ui/badge';
import { 
  CalendarDays, 
  Plus, 
  Users,
  Calendar,
  Clock,
  MapPin,
  Edit,
  Trash2,
  Check,
  X,
  Info
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { pl } from 'date-fns/locale';

// Mock data - to be replaced with real API data
const mockInstallers = [
  { id: 1, name: 'Jan Kowalski', services: ['Montaż drzwi', 'Montaż podłogi'] },
  { id: 2, name: 'Marek Nowak', services: ['Montaż drzwi'] },
  { id: 3, name: 'Paweł Wiśniewski', services: ['Montaż podłogi', 'Transport'] }
];

const mockSchedule = [
  { 
    id: 1, 
    installerId: 1, 
    orderNumber: 'ZL-2025-04-1001',
    address: 'ul. Kwiatowa 12, Szczecin',
    date: '2025-04-26',
    timeSlot: '09:00-12:00',
    clientName: 'Adam Malinowski',
    clientPhone: '123456789',
    serviceType: 'Montaż drzwi',
    status: 'zaplanowane'
  },
  { 
    id: 2, 
    installerId: 1, 
    orderNumber: 'ZL-2025-04-1002',
    address: 'ul. Długa 45, Szczecin',
    date: '2025-04-26',
    timeSlot: '13:00-16:00',
    clientName: 'Marta Kowalczyk',
    clientPhone: '987654321',
    serviceType: 'Montaż podłogi',
    status: 'zaplanowane'
  },
  { 
    id: 3, 
    installerId: 2, 
    orderNumber: 'ZL-2025-04-1003',
    address: 'ul. Szeroka 78, Szczecin',
    date: '2025-04-27',
    timeSlot: '09:00-12:00',
    clientName: 'Tomasz Nowicki',
    clientPhone: '555666777',
    serviceType: 'Montaż drzwi',
    status: 'zakończone'
  },
  { 
    id: 4, 
    installerId: 3, 
    orderNumber: 'ZL-2025-04-1004',
    address: 'ul. Polna 23, Szczecin',
    date: '2025-04-29',
    timeSlot: '15:00-18:00',
    clientName: 'Anna Wiśniewska',
    clientPhone: '111222333',
    serviceType: 'Montaż podłogi',
    status: 'zaplanowane'
  }
];

const mockOrders = [
  { 
    id: 101,
    orderNumber: 'ZL-2025-04-1005',
    clientName: 'Karolina Dąbrowska',
    clientPhone: '444555666',
    installationAddress: 'ul. Morska 56, Szczecin',
    serviceType: 'Montaż drzwi',
    status: 'nowe'
  },
  { 
    id: 102,
    orderNumber: 'ZL-2025-04-1006',
    clientName: 'Robert Jankowski',
    clientPhone: '777888999',
    installationAddress: 'ul. Leśna 89, Szczecin',
    serviceType: 'Montaż podłogi',
    status: 'nowe'
  }
];

const scheduleItemSchema = z.object({
  installerId: z.string().min(1, { message: "Wybierz montażystę" }),
  orderNumber: z.string().min(1, { message: "Wybierz zlecenie" }),
  date: z.string().min(1, { message: "Wybierz datę" }),
  timeSlot: z.string().min(1, { message: "Wybierz przedział czasowy" })
});

type ScheduleFormData = z.infer<typeof scheduleItemSchema>;

export default function CompanySchedule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [selectedInstaller, setSelectedInstaller] = useState<string>('all');
  
  // Get start of week (Monday) and calculate days of the week
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  
  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleItemSchema),
    defaultValues: {
      installerId: "",
      orderNumber: "",
      date: "",
      timeSlot: ""
    }
  });

  // Filter schedule items based on selected installer and week
  const filteredSchedule = mockSchedule.filter(item => {
    const itemDate = new Date(item.date);
    const isInCurrentWeek = itemDate >= startDate && itemDate < addDays(startDate, 7);
    return (selectedInstaller === 'all' || Number(selectedInstaller) === item.installerId) && isInCurrentWeek;
  });

  // Group schedule items by day
  const scheduleByDay = weekDays.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return {
      date: day,
      items: filteredSchedule.filter(item => item.date === dayStr)
    };
  });

  // Time slot options
  const timeSlots = [
    "08:00-11:00",
    "09:00-12:00",
    "10:00-13:00",
    "11:00-14:00",
    "12:00-15:00",
    "13:00-16:00",
    "14:00-17:00",
    "15:00-18:00",
    "16:00-19:00"
  ];

  const handleAddNewSchedule = () => {
    setEditingSchedule(null);
    form.reset({
      installerId: "",
      orderNumber: "",
      date: format(new Date(), 'yyyy-MM-dd'),
      timeSlot: "09:00-12:00"
    });
    setDialogOpen(true);
  };

  const handleEditSchedule = (scheduleItem: any) => {
    setEditingSchedule(scheduleItem);
    form.reset({
      installerId: scheduleItem.installerId.toString(),
      orderNumber: scheduleItem.orderNumber,
      date: scheduleItem.date,
      timeSlot: scheduleItem.timeSlot
    });
    setDialogOpen(true);
  };

  const handleDeleteSchedule = (id: number) => {
    if (confirm("Czy na pewno chcesz usunąć tę pozycję z grafiku?")) {
      // This would be a real API call in production
      console.log("Deleting schedule item:", id);
      toast({
        title: "Funkcja w przygotowaniu",
        description: "Usuwanie pozycji grafiku będzie dostępne wkrótce.",
      });
    }
  };

  const handleCompleteSchedule = (id: number) => {
    // This would be a real API call in production
    console.log("Marking schedule item as completed:", id);
    toast({
      title: "Funkcja w przygotowaniu",
      description: "Oznaczanie pozycji jako zakończone będzie dostępne wkrótce.",
    });
  };

  const onSubmit = (data: ScheduleFormData) => {
    // This would be a real API call in production
    console.log("Submitting schedule data:", data);
    toast({
      title: "Funkcja w przygotowaniu",
      description: "Dodawanie pozycji do grafiku będzie dostępne wkrótce.",
    });
    setDialogOpen(false);
  };

  const getInstallerName = (id: number) => {
    const installer = mockInstallers.find(i => i.id === id);
    return installer ? installer.name : 'Nieznany montażysta';
  };

  const getOrderDetails = (orderNumber: string) => {
    return mockOrders.find(o => o.orderNumber === orderNumber) || 
           mockSchedule.find(s => s.orderNumber === orderNumber);
  };

  const prevWeek = () => {
    setCurrentDate(subWeeks(currentDate, 1));
  };

  const nextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1));
  };

  const resetToCurrentWeek = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-4 pb-32 md:pb-0">
      <BackButton fallbackPath="/" />
      <Card className="w-full">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold flex items-center">
                <CalendarDays className="mr-2 h-5 w-5" />
                Grafik prac
              </CardTitle>
              <CardDescription>
                Planuj i zarządzaj harmonogramem prac montażowych
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div>
                <Select
                  value={selectedInstaller}
                  onValueChange={setSelectedInstaller}
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Wybierz montażystę" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszyscy montażyści</SelectItem>
                    {mockInstallers.map(installer => (
                      <SelectItem key={installer.id} value={installer.id.toString()}>
                        {installer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddNewSchedule}>
                <Plus className="mr-2 h-4 w-4" /> Dodaj do grafiku
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex space-x-2">
              <Button variant="outline" onClick={prevWeek}>
                &larr; Poprzedni tydzień
              </Button>
              <Button variant="outline" onClick={nextWeek}>
                Następny tydzień &rarr;
              </Button>
              <Button variant="outline" onClick={resetToCurrentWeek}>
                Bieżący tydzień
              </Button>
            </div>
            <div className="text-lg font-medium">
              {format(startDate, 'd MMMM', { locale: pl })} - {format(addDays(startDate, 6), 'd MMMM yyyy', { locale: pl })}
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            {scheduleByDay.map((day, index) => (
              <div key={index} className="border rounded-md p-3">
                <div className={`text-center p-2 mb-2 rounded-md ${format(day.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'bg-blue-100 font-bold' : 'bg-gray-100'}`}>
                  <div className="font-medium">{format(day.date, 'EEEE', { locale: pl })}</div>
                  <div>{format(day.date, 'd MMMM', { locale: pl })}</div>
                </div>
                
                <div className="space-y-2">
                  {day.items.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-2">
                      Brak zaplanowanych prac
                    </div>
                  ) : (
                    day.items.map(item => {
                      const orderDetails = getOrderDetails(item.orderNumber);
                      return (
                        <div 
                          key={item.id} 
                          className={`p-2 rounded-md border text-sm ${item.status === 'zakończone' ? 'bg-gray-50 border-gray-200' : 'bg-white border-blue-200'}`}
                        >
                          <div className="font-medium flex justify-between items-center">
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {item.timeSlot}
                            </span>
                            <Badge variant={item.status === 'zakończone' ? 'secondary' : 'outline'}>
                              {item.status}
                            </Badge>
                          </div>
                          <div className="mt-1">
                            <div className="flex items-center">
                              <Users className="h-3 w-3 mr-1 text-gray-500" />
                              {getInstallerName(item.installerId)}
                            </div>
                            <div className="flex items-center mt-1">
                              <MapPin className="h-3 w-3 mr-1 text-gray-500" />
                              {item.address}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="p-0 h-auto">
                                    <Info className="h-4 w-4 text-blue-500" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72">
                                  <div className="space-y-2">
                                    <h4 className="font-medium">{item.orderNumber}</h4>
                                    <div className="text-sm">
                                      <div><strong>Klient:</strong> {item.clientName}</div>
                                      <div><strong>Telefon:</strong> {item.clientPhone}</div>
                                      <div><strong>Usługa:</strong> {item.serviceType}</div>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <div className="flex space-x-1">
                                {item.status !== 'zakończone' && (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleCompleteSchedule(item.id)}
                                    >
                                      <Check className="h-4 w-4 text-green-500" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleEditSchedule(item)}
                                    >
                                      <Edit className="h-4 w-4 text-blue-500" />
                                    </Button>
                                  </>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleDeleteSchedule(item.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingSchedule ? "Edytuj wpis w grafiku" : "Dodaj nowy wpis do grafiku"}</DialogTitle>
                <DialogDescription>
                  {editingSchedule 
                    ? "Zaktualizuj szczegóły zaplanowanych prac." 
                    : "Zaplanuj nowe prace montażowe w grafiku."}
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="installerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montażysta</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Wybierz montażystę" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mockInstallers.map(installer => (
                              <SelectItem key={installer.id} value={installer.id.toString()}>
                                {installer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="orderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zlecenie</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Wybierz zlecenie" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mockOrders.map(order => (
                              <SelectItem key={order.id} value={order.orderNumber}>
                                {order.orderNumber} - {order.clientName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="timeSlot"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Przedział czasowy</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Wybierz godziny" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {timeSlots.map(slot => (
                              <SelectItem key={slot} value={slot}>
                                {slot}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter className="sm:justify-start">
                    <Button type="submit">
                      {editingSchedule ? "Zaktualizuj" : "Dodaj"} do grafiku
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setDialogOpen(false)}
                    >
                      Anuluj
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}