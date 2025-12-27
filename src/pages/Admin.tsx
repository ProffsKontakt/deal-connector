import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ResizableTableHead } from '@/components/ui/resizable-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CreateOrganizationDialog } from '@/components/admin/CreateOrganizationDialog';
import { BulkImportPartnersDialog } from '@/components/admin/BulkImportPartnersDialog';
import { EditPartnerDialog } from '@/components/admin/EditPartnerDialog';
import { AddUserDialog } from '@/components/admin/AddUserDialog';
import { ProductManagement } from '@/components/admin/ProductManagement';
import { AuditLogSection } from '@/components/admin/AuditLogSection';
import { toast } from 'sonner';
import { Building2, Users, CreditCard, Check, X, Settings, Inbox, Archive, Trash2, Settings2, Package, History } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Navigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type UserRole = Database['public']['Enums']['user_role'];
type CreditStatus = Database['public']['Enums']['credit_status'];

interface Organization {
  id: string;
  name: string;
  status: 'active' | 'archived';
  contact_person_name: string | null;
  contact_phone: string | null;
  price_per_solar_deal: number | null;
  price_per_battery_deal: number | null;
  price_per_site_visit: number | null;
  is_sales_consultant?: boolean;
  billing_model?: string;
  company_markup_share?: number;
  base_cost_for_billing?: number;
  eur_to_sek_rate?: number;
  lf_finans_percent?: number;
  default_customer_price?: number;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  organization_id: string | null;
}

interface CreditRequest {
  id: string;
  status: CreditStatus;
  reason: string | null;
  created_at: string;
  contact: { email: string } | null;
  organization: { name: string } | null;
  requested_by_profile: { email: string } | null;
}

const Admin = () => {
  const { profile } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [creditRequests, setCreditRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [orgStatusFilter, setOrgStatusFilter] = useState<'active' | 'archived'>('active');
  const [deleteOrg, setDeleteOrg] = useState<{ id: string; name: string } | null>(null);
  const [deleteUser, setDeleteUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchData();
    }
  }, [profile, orgStatusFilter]);

  const fetchData = async () => {
    try {
      const [orgsRes, profilesRes, creditsRes] = await Promise.all([
        supabase.from('organizations').select('*').eq('status', orgStatusFilter).order('name'),
        supabase.from('profiles').select('*').order('email'),
        supabase.from('credit_requests')
          .select(`
            *,
            contact:contacts(email),
            organization:organizations(name),
            requested_by_profile:profiles!credit_requests_requested_by_fkey(email)
          `)
          .order('created_at', { ascending: false })
      ]);

      if (orgsRes.data) {
        setOrganizations(orgsRes.data as Organization[]);
      }
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (creditsRes.data) setCreditRequests(creditsRes.data as CreditRequest[]);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveOrg = async (orgId: string) => {
    const { error } = await supabase
      .from('organizations')
      .update({ status: 'archived' })
      .eq('id', orgId);

    if (error) {
      toast.error('⚠️ Kunde inte arkivera partner');
      return;
    }

    toast.success('Partner arkiverad');
    fetchData();
  };

  const handleActivateOrg = async (orgId: string) => {
    const { error } = await supabase
      .from('organizations')
      .update({ status: 'active' })
      .eq('id', orgId);

    if (error) {
      toast.error('⚠️ Kunde inte aktivera partner');
      return;
    }

    toast.success('Partner aktiverad');
    fetchData();
  };

  const handleDeleteOrg = async () => {
    if (!deleteOrg) return;

    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', deleteOrg.id);

    if (error) {
      toast.error('⚠️ Kunde inte ta bort partner: ' + error.message);
      return;
    }

    toast.success('Partner borttagen');
    setDeleteOrg(null);
    fetchData();
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      toast.error('⚠️ Kunde inte ändra roll');
      return;
    }

    await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);

    toast.success('🎉 Roll uppdaterad');
    fetchData();
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    try {
      // Delete from user_roles first
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', deleteUser.id);

      // Delete from profiles
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', deleteUser.id);

      if (error) throw error;

      toast.success('Användare borttagen');
      setDeleteUser(null);
      fetchData();
    } catch (error: any) {
      toast.error('Kunde inte ta bort användare: ' + error.message);
    }
  };

  const handleCreditAction = async (requestId: string, status: 'approved' | 'denied') => {
    const { error } = await supabase
      .from('credit_requests')
      .update({ status })
      .eq('id', requestId);

    if (error) {
      toast.error('⚠️ Kunde inte uppdatera kreditbegäran');
      return;
    }

    toast.success(status === 'approved' ? '🎉 Kredit godkänd' : '✓ Kredit nekad');
    fetchData();
  };

  if (profile?.role !== 'admin') {
    return <Navigate to="/deals" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground text-sm">Laddar admin...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <h1 className="page-title">Admin Panel</h1>
        </div>
        <p className="page-description">
          Hantera organisationer, användare och kreditbegäranden
        </p>
      </div>

      <Tabs defaultValue="organizations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 max-w-3xl bg-muted/50 p-1">
          <TabsTrigger value="organizations" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Partners</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Produkter</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Användare</span>
          </TabsTrigger>
          <TabsTrigger value="credits" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Krediter</span>
          </TabsTrigger>
          <TabsTrigger value="auditlog" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Ändringslogg</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="animate-fade-in">
          <Card className="glass-card">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-xl">Partners & Priser</CardTitle>
                <CardDescription>Hantera partners och deras prissättning</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Status filter buttons */}
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <Button
                    variant={orgStatusFilter === 'active' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setOrgStatusFilter('active')}
                    className="rounded-none"
                  >
                    Aktiv
                  </Button>
                  <Button
                    variant={orgStatusFilter === 'archived' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setOrgStatusFilter('archived')}
                    className="rounded-none"
                  >
                    Avstängd
                  </Button>
                </div>
                <BulkImportPartnersDialog onImported={fetchData} />
                <CreateOrganizationDialog onCreated={fetchData} />
              </div>
            </CardHeader>
            <CardContent>
              {organizations.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title={orgStatusFilter === 'active' ? 'Inga aktiva partners' : 'Inga arkiverade partners'}
                  description={orgStatusFilter === 'active' 
                    ? 'Skapa din första partner för att komma igång' 
                    : 'Det finns inga arkiverade partners'}
                />
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <ResizableTableHead className="font-semibold">Partner</ResizableTableHead>
                        <ResizableTableHead className="font-semibold">Sol-pris</ResizableTableHead>
                        <ResizableTableHead className="font-semibold">Batteri-pris</ResizableTableHead>
                        <ResizableTableHead className="font-semibold">Platsbesök-pris</ResizableTableHead>
                        <ResizableTableHead className="w-36 font-semibold">Åtgärder</ResizableTableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {organizations.map((org) => (
                        <TableRow key={org.id} className="group">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-medium">{org.name}</p>
                                {org.contact_person_name && (
                                  <p className="text-xs text-muted-foreground">{org.contact_person_name}</p>
                                )}
                              </div>
                              {org.is_sales_consultant && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                                  Säljkonsult
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">
                              {org.price_per_solar_deal ? `${org.price_per_solar_deal.toLocaleString('sv-SE')} kr` : '–'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">
                              {org.price_per_battery_deal ? `${org.price_per_battery_deal.toLocaleString('sv-SE')} kr` : '–'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">
                              {org.price_per_site_visit ? `${org.price_per_site_visit.toLocaleString('sv-SE')} kr` : '–'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingOrg(org)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Settings2 className="w-4 h-4 mr-1" />
                                Redigera
                              </Button>
                              {orgStatusFilter === 'active' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleArchiveOrg(org.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Arkivera"
                                >
                                  <Archive className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleActivateOrg(org.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Aktivera"
                                >
                                  <Building2 className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                onClick={() => setDeleteOrg({ id: org.id, name: org.name })}
                                title="Ta bort"
                              >
                                <Trash2 className="w-4 h-4" />
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
          </Card>
          
          {/* Edit Partner Dialog */}
          <EditPartnerDialog
            partner={editingOrg}
            open={!!editingOrg}
            onOpenChange={(open) => !open && setEditingOrg(null)}
            onUpdated={fetchData}
          />
        </TabsContent>

        <TabsContent value="products" className="animate-fade-in">
          <ProductManagement />
        </TabsContent>

        <TabsContent value="users" className="animate-fade-in">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-xl">Användare & Roller</CardTitle>
                <CardDescription>Hantera användarkonton och behörigheter</CardDescription>
              </div>
              <AddUserDialog onCreated={fetchData} />
            </CardHeader>
            <CardContent>
              {profiles.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Inga användare"
                  description="Inga användare har registrerats ännu"
                />
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <ResizableTableHead className="font-semibold">E-post</ResizableTableHead>
                        <ResizableTableHead className="font-semibold">Namn</ResizableTableHead>
                        <ResizableTableHead className="font-semibold">Roll</ResizableTableHead>
                        <ResizableTableHead className="w-16 font-semibold">Åtgärd</ResizableTableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((user) => (
                        <TableRow key={user.id} className="group">
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {user.full_name || '–'}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(value: UserRole) => handleRoleChange(user.id, value)}
                            >
                              <SelectTrigger className="w-44 h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="teamleader">Teamleader</SelectItem>
                                <SelectItem value="opener">Opener</SelectItem>
                                <SelectItem value="closer">Closer</SelectItem>
                                <SelectItem value="organization">Partner</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {user.role !== 'admin' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                onClick={() => setDeleteUser({ id: user.id, email: user.email })}
                                title="Ta bort användare"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits" className="animate-fade-in">
          <Card className="glass-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Kreditbegäranden</CardTitle>
              <CardDescription>Granska och hantera inkomna kreditförfrågningar</CardDescription>
            </CardHeader>
            <CardContent>
              {creditRequests.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Inga kreditbegäranden"
                  description="Det finns inga kreditförfrågningar att hantera just nu"
                />
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <ResizableTableHead className="font-semibold">Kontakt</ResizableTableHead>
                        <ResizableTableHead className="font-semibold">Organisation</ResizableTableHead>
                        <ResizableTableHead className="font-semibold">Anledning</ResizableTableHead>
                        <ResizableTableHead className="font-semibold">Datum</ResizableTableHead>
                        <ResizableTableHead className="font-semibold">Status</ResizableTableHead>
                        <ResizableTableHead className="w-28 font-semibold">Åtgärder</ResizableTableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">
                            {request.contact?.email || '–'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {request.organization?.name || '–'}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-xs truncate">
                            {request.reason || '–'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(request.created_at), 'dd MMM yyyy', { locale: sv })}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={request.status} />
                          </TableCell>
                          <TableCell>
                            {request.status === 'pending' && (
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0 text-success hover:bg-success/10 hover:text-success hover:border-success/30"
                                  onClick={() => handleCreditAction(request.id, 'approved')}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                                  onClick={() => handleCreditAction(request.id, 'denied')}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteOrg} onOpenChange={() => setDeleteOrg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort partner?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort <strong>{deleteOrg?.name}</strong>? 
              Detta kan inte ångras och all data kopplad till denna partner kan påverkas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrg} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete user confirmation dialog */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort användare?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort <strong>{deleteUser?.email}</strong>? 
              Detta kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;