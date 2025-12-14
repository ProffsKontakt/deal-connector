import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { CreateOrganizationDialog } from '@/components/admin/CreateOrganizationDialog';
import { toast } from 'sonner';
import { Building2, Users, CreditCard, Check, X, Save } from 'lucide-react';
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
      toast.error('Kunde inte spara priser');
      return;
    }
    
    toast.success('Priser uppdaterade');
    setEditingOrg(null);
    fetchData();
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      toast.error('Kunde inte ändra roll');
      return;
    }

    // Also update user_roles table
    await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);

    toast.success('Roll uppdaterad');
    fetchData();
  };

  const handleCreditAction = async (requestId: string, status: 'approved' | 'denied') => {
    const { error } = await supabase
      .from('credit_requests')
      .update({ status })
      .eq('id', requestId);

    if (error) {
      toast.error('Kunde inte uppdatera kreditbegäran');
      return;
    }

    toast.success(status === 'approved' ? 'Kredit godkänd' : 'Kredit nekad');
    fetchData();
  };

  if (profile?.role !== 'admin') {
    return <Navigate to="/deals" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Laddar admin...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
        <p className="text-muted-foreground mt-1">
          Hantera organisationer, användare och kreditbegäranden
        </p>
      </div>

      <Tabs defaultValue="organizations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="organizations" className="gap-2">
            <Building2 className="w-4 h-4" />
            Organisationer
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Användare
          </TabsTrigger>
          <TabsTrigger value="credits" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Krediter
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Organisationer & Priser</CardTitle>
              <CreateOrganizationDialog onCreated={fetchData} />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Namn</TableHead>
                    <TableHead>Pris per Sol-deal</TableHead>
                    <TableHead>Pris per Batteri-deal</TableHead>
                    <TableHead className="w-24">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
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
                            className="w-32"
                            placeholder="0"
                          />
                        ) : (
                          <span className="text-muted-foreground">
                            {org.price_per_solar_deal ? `${org.price_per_solar_deal} kr` : '-'}
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
                            className="w-32"
                            placeholder="0"
                          />
                        ) : (
                          <span className="text-muted-foreground">
                            {org.price_per_battery_deal ? `${org.price_per_battery_deal} kr` : '-'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingOrg === org.id ? (
                          <Button
                            size="sm"
                            onClick={() => handleSaveOrgPrices(org.id)}
                            className="gap-1"
                          >
                            <Save className="w-3 h-3" />
                            Spara
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingOrg(org.id)}
                          >
                            Redigera
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Användare & Roller</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>E-post</TableHead>
                    <TableHead>Namn</TableHead>
                    <TableHead>Roll</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.full_name || '-'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(value: UserRole) => handleRoleChange(user.id, value)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="teamleader">Teamleader</SelectItem>
                            <SelectItem value="opener">Opener</SelectItem>
                            <SelectItem value="organization">Organization</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Kreditbegäranden</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Kontakt</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Anledning</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Inga kreditbegäranden
                      </TableCell>
                    </TableRow>
                  ) : (
                    creditRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.contact?.email || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {request.organization?.name || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {request.reason || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(request.created_at), 'dd MMM yyyy', { locale: sv })}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} />
                        </TableCell>
                        <TableCell>
                          {request.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-status-approved hover:bg-status-approved/10"
                                onClick={() => handleCreditAction(request.id, 'approved')}
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-status-denied hover:bg-status-denied/10"
                                onClick={() => handleCreditAction(request.id, 'denied')}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
