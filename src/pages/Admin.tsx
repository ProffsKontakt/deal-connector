import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CreateOrganizationDialog } from '@/components/admin/CreateOrganizationDialog';
import { AddUserDialog } from '@/components/admin/AddUserDialog';
import { toast } from 'sonner';
import { Building2, Users, CreditCard, Check, X, Save, Settings, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Navigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];
type CreditStatus = Database['public']['Enums']['credit_status'];

interface Organization {
  id: string;
  name: string;
  price_per_solar_deal: number | null;
  price_per_battery_deal: number | null;
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
  const [editingOrg, setEditingOrg] = useState<string | null>(null);
  const [orgPrices, setOrgPrices] = useState<Record<string, { solar: string; battery: string }>>({});

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    try {
      const [orgsRes, profilesRes, creditsRes] = await Promise.all([
        supabase.from('organizations').select('*').order('name'),
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
        setOrganizations(orgsRes.data);
        const prices: Record<string, { solar: string; battery: string }> = {};
        orgsRes.data.forEach(org => {
          prices[org.id] = {
            solar: org.price_per_solar_deal?.toString() || '',
            battery: org.price_per_battery_deal?.toString() || ''
          };
        });
        setOrgPrices(prices);
      }
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (creditsRes.data) setCreditRequests(creditsRes.data as CreditRequest[]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrgPrices = async (orgId: string) => {
    const prices = orgPrices[orgId];
    const { error } = await supabase
      .from('organizations')
      .update({
        price_per_solar_deal: prices.solar ? parseFloat(prices.solar) : null,
        price_per_battery_deal: prices.battery ? parseFloat(prices.battery) : null
      })
      .eq('id', orgId);

    if (error) {
      toast.error('⚠️ Kunde inte spara priser');
      return;
    }
    
    toast.success('🎉 Priser uppdaterade');
    setEditingOrg(null);
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
        <TabsList className="grid w-full grid-cols-3 max-w-lg bg-muted/50 p-1">
          <TabsTrigger value="organizations" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Organisationer</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Användare</span>
          </TabsTrigger>
          <TabsTrigger value="credits" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Krediter</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="animate-fade-in">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-xl">Organisationer & Priser</CardTitle>
                <CardDescription>Hantera organisationer och deras prissättning</CardDescription>
              </div>
              <CreateOrganizationDialog onCreated={fetchData} />
            </CardHeader>
            <CardContent>
              {organizations.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="Inga organisationer"
                  description="Skapa din första organisation för att komma igång"
                />
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="font-semibold">Namn</TableHead>
                        <TableHead className="font-semibold">Pris per Sol-deal</TableHead>
                        <TableHead className="font-semibold">Pris per Batteri-deal</TableHead>
                        <TableHead className="w-28 font-semibold">Åtgärder</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {organizations.map((org) => (
                        <TableRow key={org.id} className="group">
                          <TableCell className="font-medium">{org.name}</TableCell>
                          <TableCell>
                            {editingOrg === org.id ? (
                              <Input
                                type="number"
                                value={orgPrices[org.id]?.solar || ''}
                                onChange={(e) => setOrgPrices(prev => ({
                                  ...prev,
                                  [org.id]: { ...prev[org.id], solar: e.target.value }
                                }))}
                                className="w-32 h-9"
                                placeholder="0"
                              />
                            ) : (
                              <span className="text-muted-foreground">
                                {org.price_per_solar_deal ? `${org.price_per_solar_deal.toLocaleString('sv-SE')} kr` : '–'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingOrg === org.id ? (
                              <Input
                                type="number"
                                value={orgPrices[org.id]?.battery || ''}
                                onChange={(e) => setOrgPrices(prev => ({
                                  ...prev,
                                  [org.id]: { ...prev[org.id], battery: e.target.value }
                                }))}
                                className="w-32 h-9"
                                placeholder="0"
                              />
                            ) : (
                              <span className="text-muted-foreground">
                                {org.price_per_battery_deal ? `${org.price_per_battery_deal.toLocaleString('sv-SE')} kr` : '–'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingOrg === org.id ? (
                              <Button
                                size="sm"
                                onClick={() => handleSaveOrgPrices(org.id)}
                                className="gap-1.5"
                              >
                                <Save className="w-3.5 h-3.5" />
                                Spara
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingOrg(org.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Redigera
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
                        <TableHead className="font-semibold">E-post</TableHead>
                        <TableHead className="font-semibold">Namn</TableHead>
                        <TableHead className="font-semibold">Roll</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((user) => (
                        <TableRow key={user.id}>
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
                                <SelectItem value="organization">Partner</SelectItem>
                              </SelectContent>
                            </Select>
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
                        <TableHead className="font-semibold">Kontakt</TableHead>
                        <TableHead className="font-semibold">Organisation</TableHead>
                        <TableHead className="font-semibold">Anledning</TableHead>
                        <TableHead className="font-semibold">Datum</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="w-28 font-semibold">Åtgärder</TableHead>
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
    </div>
  );
};

export default Admin;