import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Users, Edit, Trash, Phone, Mail, CheckSquare } from "lucide-react";
import { z } from "zod";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";

// Interfejs dla danych montażysty
interface Installer {
  id: number;
  name: string;
  email: string;
  phone: string;
  services: string[];
  isActive?: boolean;
  role: string;
  companyId: number;
  company_id: number; // Dodano dla kompatybilności z bazą danych
  companyName?: string;
};

const installerSchema = z.object({
  name: z.string().min(3, { message: "Imię i nazwisko wymagane" }),
  email: z.string().email({ message: "Nieprawidłowy format email" }),
  phone: z.string().min(9, { message: "Nieprawidłowy numer telefonu" }),
  services: z.array(z.string()).min(1, { message: "Wybierz przynajmniej jedną usługę" })
});

type InstallerFormData = z.infer<typeof installerSchema>;

export default function CompanyInstallers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInstaller, setEditingInstaller] = useState<Installer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Pobieranie montażystów z API
  const companyId = user?.companyId;
  
  const { 
    data: installers = [], 
    isLoading,
    refetch
  } = useQuery<Installer[]>({
    queryKey: ["/api/installers", companyId],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!user
  });

  // Filtrowanie montażystów
  const filteredInstallers = installers
    .filter(installer => showInactive || installer.isActive !== false)
    .filter(installer => 
      installer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      installer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      installer.phone?.includes(searchTerm)
    );

  const form = useForm<InstallerFormData>({
    resolver: zodResolver(installerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      services: []
    }
  });

  // Mutacja do dodawania nowego montażysty
  const createInstallerMutation = useMutation({
    mutationFn: async (data: InstallerFormData) => {
      // W przypadku rzeczywistej implementacji, wysyłamy żądanie do API
      const response = await apiRequest("POST", "/api/users", {
        ...data,
        role: "installer",
        companyId: user?.companyId,
        companyName: user?.companyName,
        password: "test1234" // Domyślne hasło, które powinno być potem zmienione przez użytkownika
      });
      return await response.json();
    },
    onSuccess: () => {
      setDialogOpen(false);
      form.reset();
      // Odświeżenie listy montażystów
      queryClient.invalidateQueries({ queryKey: ["/api/installers", companyId] });
      toast({
        title: "Sukces",
        description: "Montażysta został dodany pomyślnie.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się dodać montażysty: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutacja do aktualizacji montażysty
  const updateInstallerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: InstallerFormData }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, {
        ...data
      });
      return await response.json();
    },
    onSuccess: () => {
      setDialogOpen(false);
      setEditingInstaller(null);
      form.reset();
      // Odświeżenie listy montażystów
      queryClient.invalidateQueries({ queryKey: ["/api/installers", companyId] });
      toast({
        title: "Sukces",
        description: "Montażysta został zaktualizowany pomyślnie.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się zaktualizować montażysty: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutacja do usuwania montażysty
  const deleteInstallerMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/users/${id}`);
      if (!response.ok) {
        throw new Error("Nie udało się usunąć montażysty");
      }
      return { success: true };
    },
    onSuccess: () => {
      // Odświeżenie listy montażystów
      queryClient.invalidateQueries({ queryKey: ["/api/installers", companyId] });
      toast({
        title: "Sukces",
        description: "Montażysta został usunięty pomyślnie.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się usunąć montażysty: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutacja do zmiany statusu aktywności montażysty
  const toggleActiveStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number, active: boolean }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, {
        isActive: active
      });
      return await response.json();
    },
    onSuccess: () => {
      // Odświeżenie listy montażystów
      queryClient.invalidateQueries({ queryKey: ["/api/installers", companyId] });
      toast({
        title: "Sukces",
        description: "Status montażysty został zmieniony pomyślnie.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się zmienić statusu montażysty: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: InstallerFormData) => {
    if (editingInstaller) {
      updateInstallerMutation.mutate({ id: editingInstaller.id, data });
    } else {
      createInstallerMutation.mutate(data);
    }
  };

  const handleAddNewInstaller = () => {
    setEditingInstaller(null);
    form.reset({
      name: "",
      email: "",
      phone: "",
      services: []
    });
    setDialogOpen(true);
  };

  const handleEditInstaller = (installer: Installer) => {
    setEditingInstaller(installer);
    form.reset({
      name: installer.name,
      email: installer.email,
      phone: installer.phone,
      services: installer.services || []
    });
    setDialogOpen(true);
  };

  const handleDeleteInstaller = (id: number) => {
    if (confirm("Czy na pewno chcesz usunąć tego montażystę?")) {
      deleteInstallerMutation.mutate(id);
    }
  };

  const handleToggleStatus = (id: number, currentStatus: boolean) => {
    toggleActiveStatusMutation.mutate({ id, active: !currentStatus });
  };

  // Service options for checkbox group
  const serviceOptions = [
    { id: "door", label: "Montaż drzwi", value: "Montaż drzwi" },
    { id: "floor", label: "Montaż podłogi", value: "Montaż podłogi" },
    { id: "transport", label: "Transport", value: "Transport" }
  ];

  return (
    <div className="pb-16 md:pb-0">
      <BackButton fallbackPath="/" className="mb-4" />
      <Card className="w-full">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Montażyści
              </CardTitle>
              <CardDescription>
                Zarządzaj montażystami w swojej firmie
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Szukaj montażysty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-auto"
              />
              {user?.role === 'admin' && (
                <Button onClick={handleAddNewInstaller}>
                  <Plus className="mr-2 h-4 w-4" /> Dodaj montażystę
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center">
            <Checkbox 
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={() => setShowInactive(!showInactive)}
            />
            <label 
              htmlFor="show-inactive" 
              className="ml-2 text-sm font-medium cursor-pointer text-gray-700"
            >
              Pokaż nieaktywnych montażystów
            </label>
          </div>

          {isLoading ? (
            <div className="py-10 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-4">Ładowanie montażystów...</p>
            </div>
          ) : filteredInstallers.length === 0 ? (
            <div className="py-10 text-center">
              {searchTerm ? (
                <p className="text-gray-500">Nie znaleziono montażystów spełniających kryteria.</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-500">Nie masz jeszcze żadnych montażystów przypisanych do swojej firmy.</p>
                  <p className="text-sm text-gray-400">Poproś administratora systemu o dodanie montażysty do Twojej firmy.</p>
                  {user?.role === 'admin' && (
                    <Button onClick={handleAddNewInstaller} variant="outline">
                      <Plus className="mr-2 h-4 w-4" /> Dodaj montażystę
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imię i nazwisko</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead>Usługi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstallers.map((installer) => (
                    <TableRow key={installer.id} className={!installer.isActive ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{installer.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="flex items-center text-sm">
                            <Mail className="h-4 w-4 mr-1 text-gray-500" />
                            {installer.email}
                          </span>
                          <span className="flex items-center text-sm mt-1">
                            <Phone className="h-4 w-4 mr-1 text-gray-500" />
                            {installer.phone}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {installer.services?.map((service) => (
                            <Badge key={service} variant="outline">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={installer.isActive !== false ? "success" : "secondary"}>
                          {installer.isActive !== false ? "Aktywny" : "Nieaktywny"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleToggleStatus(installer.id, !!installer.isActive)}
                          >
                            <CheckSquare className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditInstaller(installer)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleDeleteInstaller(installer.id)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>{editingInstaller ? "Edytuj montażystę" : "Dodaj nowego montażystę"}</DialogTitle>
              <DialogDescription>
                {editingInstaller 
                  ? "Zmień dane montażysty wypełniając poniższy formularz." 
                  : "Dodaj nowego montażystę do firmy wypełniając poniższy formularz."}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Imię i nazwisko</FormLabel>
                      <FormControl>
                        <Input placeholder="Jan Kowalski" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="jan.kowalski@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon</FormLabel>
                      <FormControl>
                        <Input placeholder="123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="services"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Usługi</FormLabel>
                        <FormDescription>
                          Wybierz usługi wykonywane przez montażystę.
                        </FormDescription>
                      </div>
                      <div className="space-y-2">
                        {serviceOptions.map((option) => (
                          <FormField
                            key={option.id}
                            control={form.control}
                            name="services"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={option.id}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(option.value)}
                                      onCheckedChange={(checked) => {
                                        const updatedValue = checked
                                          ? [...field.value, option.value]
                                          : field.value?.filter(
                                              (value) => value !== option.value
                                            );
                                        field.onChange(updatedValue);
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">
                                    {option.label}
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} type="button">
                    Anuluj
                  </Button>
                  <Button type="submit" disabled={createInstallerMutation.isPending || updateInstallerMutation.isPending}>
                    {createInstallerMutation.isPending || updateInstallerMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                        Zapisywanie...
                      </>
                    ) : editingInstaller ? "Zapisz zmiany" : "Dodaj montażystę"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}