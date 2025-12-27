import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, Sun, Battery, Calculator, UserCheck, MapPin, Wallet, Pencil } from 'lucide-react';
import { CreateOpenerDialog } from '@/components/saljare/CreateOpenerDialog';
import { CreateCloserDialog } from '@/components/saljare/CreateCloserDialog';
import { EditOpenerDialog } from '@/components/saljare/EditOpenerDialog';
import { EditCloserDialog } from '@/components/saljare/EditCloserDialog';
import { SalariesView } from '@/components/saljare/SalariesView';
interface OpenerStats {
  id: string;
  email: string;
  full_name: string | null;
  totalDeals: number;
  solarDeals: number;
  batteryDeals: number;
  sunBatteryDeals: number;
  closedDeals: number;
  openerCommission: number;
  // Adversus API fields (placeholder - to be populated from API)
  callsMade: number | null;
  conversations: number | null;
  bookings: number | null;
  hitRate: number | null;
}

interface CloserStats {
  id: string;
  email: string;
  full_name: string | null;
  regions: { name: string; organization: string }[];
  totalSales: number;
  closedWonSales: number;
  closedLostSales: number;
  processedSales: number;
  totalCommission: number;
  totalInvoiceable: number;
  generatedRevenue: number;
  profitMargin: number;
}

interface Region {
  id: string;
  name: string;
}

const Saljare = () => {
  const { profile } = useAuth();
  const [openers, setOpeners] = useState<OpenerStats[]>([]);
  const [closers, setClosers] = useState<CloserStats[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState<'openers' | 'closers' | 'loner'>('openers');
  const [activeSubTab, setActiveSubTab] = useState<'prestanda' | 'siffror'>('prestanda');
  const [editingOpener, setEditingOpener] = useState<OpenerStats | null>(null);
  const [editingCloser, setEditingCloser] = useState<CloserStats | null>(null);
  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchAllData();
    }
  }, [profile]);

  const fetchAllData = async () => {
    await Promise.all([fetchOpenerStats(), fetchCloserStats(), fetchRegions()]);
    setLoading(false);
  };

  const fetchRegions = async () => {
    const { data } = await supabase.from('regions').select('id, name');
    if (data) setRegions(data);
  };

  const fetchOpenerStats = async () => {
    try {
      const { data: openerProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('role', ['opener', 'teamleader']);

      if (!openerProfiles) {
        setOpeners([]);
        return;
      }

      const { data: contacts } = await supabase
        .from('contacts')
        .select('opener_id, interest');

      // Get closed sales to calculate opener commissions
      const { data: closedSales } = await supabase
        .from('sales')
        .select('id, contact_id, opener_commission, pipeline_status')
        .eq('pipeline_status', 'closed_won');

      // Get contact opener mapping for closed sales
      const closedContactIds = closedSales?.map(s => s.contact_id) || [];
      const { data: closedContacts } = await supabase
        .from('contacts')
        .select('id, opener_id')
        .in('id', closedContactIds.length > 0 ? closedContactIds : ['00000000-0000-0000-0000-000000000000']);

      const openerStats: OpenerStats[] = openerProfiles.map((opener) => {
        const openerContacts = contacts?.filter(c => c.opener_id === opener.id) || [];
        
        // Calculate closed deals and commission
        const openerClosedContactIds = closedContacts?.filter(c => c.opener_id === opener.id).map(c => c.id) || [];
        const openerClosedSales = closedSales?.filter(s => openerClosedContactIds.includes(s.contact_id)) || [];
        const totalOpenerCommission = openerClosedSales.reduce((sum, s) => sum + (Number(s.opener_commission) || 1000), 0);

        return {
          id: opener.id,
          email: opener.email,
          full_name: opener.full_name,
          totalDeals: openerContacts.length,
          solarDeals: openerContacts.filter(c => c.interest === 'sun').length,
          batteryDeals: openerContacts.filter(c => c.interest === 'battery').length,
          sunBatteryDeals: openerContacts.filter(c => c.interest === 'sun_battery').length,
          closedDeals: openerClosedSales.length,
          openerCommission: totalOpenerCommission,
          // Adversus API fields - placeholder (will be populated from API)
          callsMade: null,
          conversations: null,
          bookings: null,
          hitRate: null,
        };
      });

      openerStats.sort((a, b) => b.totalDeals - a.totalDeals);
      setOpeners(openerStats);
    } catch (error) {
      console.error('Error fetching opener stats:', error);
    }
  };

  const fetchCloserStats = async () => {
    try {
      const { data: closerProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('role', 'closer');

      if (!closerProfiles || closerProfiles.length === 0) {
        setClosers([]);
        return;
      }

      // Get closer regions with organization info
      const { data: closerRegions } = await supabase
        .from('closer_regions')
        .select(`
          closer_id,
          region:regions(name),
          organization:organizations(name)
        `);

      // Get sales data
      const { data: sales } = await supabase
        .from('sales')
        .select('closer_id, pipeline_status, closer_commission, invoiceable_amount');

      const closerStats: CloserStats[] = closerProfiles.map((closer) => {
        const closerSales = sales?.filter(s => s.closer_id === closer.id) || [];
        const closedWonSales = closerSales.filter(s => s.pipeline_status === 'closed_won');
        const closedLostSales = closerSales.filter(s => s.pipeline_status === 'closed_lost');
        const processedSales = closerSales.filter(s => 
          s.pipeline_status === 'closed_won' || s.pipeline_status === 'closed_lost'
        );
        
        const regionsForCloser = closerRegions
          ?.filter(cr => cr.closer_id === closer.id)
          .map(cr => ({
            name: (cr.region as any)?.name || 'Okänd',
            organization: (cr.organization as any)?.name || 'Okänt'
          })) || [];

        const totalCommission = closedWonSales.reduce((sum, s) => sum + (Number(s.closer_commission) || 0), 0);
        const totalInvoiceable = closedWonSales.reduce((sum, s) => sum + (Number(s.invoiceable_amount) || 0), 0);

        return {
          id: closer.id,
          email: closer.email,
          full_name: closer.full_name,
          regions: regionsForCloser,
          totalSales: closerSales.length,
          closedWonSales: closedWonSales.length,
          closedLostSales: closedLostSales.length,
          processedSales: processedSales.length,
          totalCommission,
          totalInvoiceable,
          generatedRevenue: totalInvoiceable,
          profitMargin: totalInvoiceable - totalCommission,
        };
      });

      closerStats.sort((a, b) => b.closedWonSales - a.closedWonSales);
      setClosers(closerStats);
    } catch (error) {
      console.error('Error fetching closer stats:', error);
    }
  };

  if (profile?.role !== 'admin') {
    return <Navigate to="/deals" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground text-sm">Laddar säljare...</span>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <h1 className="page-title">Säljare</h1>
        </div>
        <p className="page-description">
          Översikt av prestanda för openers och closers
        </p>
      </div>

      {/* Main Tabs - Openers / Closers / Löner */}
      <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as 'openers' | 'closers' | 'loner')}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="openers" className="gap-2">
            <Users className="w-4 h-4" />
            Openers
          </TabsTrigger>
          <TabsTrigger value="closers" className="gap-2">
            <UserCheck className="w-4 h-4" />
            Closers
          </TabsTrigger>
          <TabsTrigger value="loner" className="gap-2">
            <Wallet className="w-4 h-4" />
            Löner
          </TabsTrigger>
        </TabsList>

        {/* Openers Tab Content */}
        <TabsContent value="openers" className="space-y-6">
          {/* Sub Tab Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={activeSubTab === 'prestanda' ? 'default' : 'outline'}
                onClick={() => setActiveSubTab('prestanda')}
                className="gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Prestanda
              </Button>
              <Button
                variant={activeSubTab === 'siffror' ? 'default' : 'outline'}
                onClick={() => setActiveSubTab('siffror')}
                className="gap-2"
              >
                <Calculator className="w-4 h-4" />
                Siffror
              </Button>
            </div>
            <CreateOpenerDialog onCreated={fetchAllData} />
          </div>

          {/* Prestanda Tab */}
          {activeSubTab === 'prestanda' && (
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle>Opener-statistik</CardTitle>
                </div>
                <CardDescription>
                  Antal leads genererade per opener
                </CardDescription>
              </CardHeader>
              <CardContent>
                {openers.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="Inga openers"
                    description="Det finns inga openers registrerade ännu"
                  />
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="font-semibold">Opener</TableHead>
                          <TableHead className="text-center font-semibold">Totalt</TableHead>
                          <TableHead className="text-center font-semibold">
                            <div className="flex items-center justify-center gap-1">
                              <Sun className="w-4 h-4 text-amber-500" />
                              Sol
                            </div>
                          </TableHead>
                          <TableHead className="text-center font-semibold">
                            <div className="flex items-center justify-center gap-1">
                              <Battery className="w-4 h-4 text-emerald-500" />
                              Batteri
                            </div>
                          </TableHead>
                          <TableHead className="text-center font-semibold">
                            <div className="flex items-center justify-center gap-1">
                              <Sun className="w-4 h-4 text-amber-500" />
                              +
                              <Battery className="w-4 h-4 text-emerald-500" />
                            </div>
                          </TableHead>
                          <TableHead className="text-center font-semibold text-muted-foreground">Ringda samtal</TableHead>
                          <TableHead className="text-center font-semibold text-muted-foreground">Konversationer</TableHead>
                          <TableHead className="text-center font-semibold text-muted-foreground">Bokningar</TableHead>
                          <TableHead className="text-center font-semibold text-muted-foreground">Hit-rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {openers.map((opener) => (
                          <TableRow key={opener.id} className="hover:bg-muted/30 group">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className="font-medium">{opener.full_name || opener.email}</p>
                                  {opener.full_name && (
                                    <p className="text-sm text-muted-foreground">{opener.email}</p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                                  onClick={() => setEditingOpener(opener)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-primary">{opener.totalDeals}</span>
                            </TableCell>
                            <TableCell className="text-center">{opener.solarDeals}</TableCell>
                            <TableCell className="text-center">{opener.batteryDeals}</TableCell>
                            <TableCell className="text-center">{opener.sunBatteryDeals}</TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {opener.callsMade ?? '–'}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {opener.conversations ?? '–'}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {opener.bookings ?? '–'}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {opener.hitRate != null ? `${(opener.hitRate * 100).toFixed(1)}%` : '–'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Siffror Tab */}
          {activeSubTab === 'siffror' && (
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  <CardTitle>Opener-provisioner</CardTitle>
                </div>
                <CardDescription>
                  1 000 kr per affär som stängs från opener-bokat lead
                </CardDescription>
              </CardHeader>
              <CardContent>
                {openers.length === 0 ? (
                  <EmptyState
                    icon={Calculator}
                    title="Inga provisioner"
                    description="Det finns inga provisioner att visa ännu"
                  />
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="font-semibold">Namn</TableHead>
                          <TableHead className="text-center font-semibold">Bokade leads</TableHead>
                          <TableHead className="text-center font-semibold">Stängda affärer</TableHead>
                          <TableHead className="text-center font-semibold">Provision/affär</TableHead>
                          <TableHead className="text-center font-semibold">Total provision</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {openers.map((opener) => (
                          <TableRow key={opener.id} className="hover:bg-muted/30 group">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className="font-medium">{opener.full_name || opener.email}</p>
                                  {opener.full_name && (
                                    <p className="text-sm text-muted-foreground">{opener.email}</p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                                  onClick={() => setEditingOpener(opener)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold">{opener.totalDeals}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-emerald-600">{opener.closedDeals}</span>
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              1 000 kr
                            </TableCell>
                            <TableCell className="text-center font-semibold text-primary">
                              {formatCurrency(opener.openerCommission)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Closers Tab Content */}
        <TabsContent value="closers" className="space-y-6">
          {/* Sub Tab Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={activeSubTab === 'prestanda' ? 'default' : 'outline'}
                onClick={() => setActiveSubTab('prestanda')}
                className="gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Prestanda
              </Button>
              <Button
                variant={activeSubTab === 'siffror' ? 'default' : 'outline'}
                onClick={() => setActiveSubTab('siffror')}
                className="gap-2"
              >
                <Calculator className="w-4 h-4" />
                Siffror
              </Button>
            </div>
            <CreateCloserDialog onCreated={fetchAllData} />
          </div>

          {/* Prestanda Tab */}
          {activeSubTab === 'prestanda' && (
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle>Closer-statistik</CardTitle>
                </div>
                <CardDescription>
                  Översikt av säljarnas prestanda och regioner
                </CardDescription>
              </CardHeader>
              <CardContent>
                {closers.length === 0 ? (
                  <EmptyState
                    icon={UserCheck}
                    title="Inga closers"
                    description="Det finns inga closers registrerade ännu. Lägg till closers via Admin-sidan."
                  />
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="font-semibold">Closer</TableHead>
                          <TableHead className="font-semibold">Regioner</TableHead>
                          <TableHead className="text-center font-semibold">Tilldelade</TableHead>
                          <TableHead className="text-center font-semibold">Bearbetade</TableHead>
                          <TableHead className="text-center font-semibold text-emerald-600">Vunna</TableHead>
                          <TableHead className="text-center font-semibold text-red-500">Förlorade</TableHead>
                          <TableHead className="text-right font-semibold">Gen. intäkt</TableHead>
                          <TableHead className="text-right font-semibold">Marginal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {closers.map((closer) => (
                          <TableRow key={closer.id} className="hover:bg-muted/30 group">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className="font-medium">{closer.full_name || closer.email}</p>
                                  {closer.full_name && (
                                    <p className="text-sm text-muted-foreground">{closer.email}</p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                                  onClick={() => setEditingCloser(closer)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {closer.regions.length > 0 ? (
                                  closer.regions.map((region, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      <MapPin className="w-3 h-3 mr-1" />
                                      {region.name} ({region.organization})
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground text-sm">Inga regioner</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold">{closer.totalSales}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold">{closer.processedSales}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-emerald-600">{closer.closedWonSales}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-red-500">{closer.closedLostSales}</span>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary">
                              {formatCurrency(closer.generatedRevenue)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              <span className={closer.profitMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                                {formatCurrency(closer.profitMargin)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Siffror Tab */}
          {activeSubTab === 'siffror' && (
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  <CardTitle>Closer-provisioner</CardTitle>
                </div>
                <CardDescription>
                  Provisioner beräknas individuellt per affär baserat på registrerade kostnader
                </CardDescription>
              </CardHeader>
              <CardContent>
                {closers.length === 0 ? (
                  <EmptyState
                    icon={Calculator}
                    title="Inga provisioner"
                    description="Det finns inga closers att visa provisioner för"
                  />
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="font-semibold">Namn</TableHead>
                          <TableHead className="text-center font-semibold">Stängda affärer</TableHead>
                          <TableHead className="text-center font-semibold">Fakturerbart</TableHead>
                          <TableHead className="text-center font-semibold">Total provision</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {closers.map((closer) => (
                          <TableRow key={closer.id} className="hover:bg-muted/30 group">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className="font-medium">{closer.full_name || closer.email}</p>
                                  {closer.full_name && (
                                    <p className="text-sm text-muted-foreground">{closer.email}</p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                                  onClick={() => setEditingCloser(closer)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-emerald-600">{closer.closedWonSales}</span>
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {formatCurrency(closer.totalInvoiceable)}
                            </TableCell>
                            <TableCell className="text-center font-semibold text-primary">
                              {formatCurrency(closer.totalCommission)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Löner Tab Content */}
        <TabsContent value="loner" className="space-y-6">
          <SalariesView />
        </TabsContent>
      </Tabs>

      {/* Edit Dialogs */}
      <EditOpenerDialog
        opener={editingOpener}
        open={!!editingOpener}
        onOpenChange={(open) => !open && setEditingOpener(null)}
        onUpdated={fetchAllData}
      />
      <EditCloserDialog
        closer={editingCloser}
        open={!!editingCloser}
        onOpenChange={(open) => !open && setEditingCloser(null)}
        onUpdated={fetchAllData}
      />
    </div>
  );
};

export default Saljare;
