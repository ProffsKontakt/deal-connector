import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ResizableTableHead } from '@/components/ui/resizable-table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { sv } from 'date-fns/locale';
import { 
  Building2, 
  TrendingUp, 
  FileText, 
  MapPin, 
  Sun, 
  Battery, 
  User, 
  Mail, 
  Phone,
  Copy,
  Download,
  BarChart3,
  Target,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { PartnerTimelineTab } from './PartnerTimelineTab';

interface PartnerData {
  id: string;
  name: string;
  contact_person_name: string | null;
  contact_phone: string | null;
  pricePerSolar: number;
  pricePerBattery: number;
  collaboration_start_date?: string | null;
}

interface Lead {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  interest: 'sun' | 'battery' | 'sun_battery';
  date_sent: string;
  opener_name: string | null;
}

interface SalesStats {
  totalDeals: number;
  wonDeals: number;
  closeRate: number;
}

interface PartnerBriefingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner: PartnerData | null;
  selectedMonth: string;
}

export function PartnerBriefingDialog({
  open,
  onOpenChange,
  partner,
  selectedMonth,
}: PartnerBriefingDialogProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salesStats, setSalesStats] = useState<SalesStats>({ totalDeals: 0, wonDeals: 0, closeRate: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && partner) {
      fetchData();
    }
  }, [open, partner, selectedMonth]);

  const fetchData = async () => {
    if (!partner) return;
    setLoading(true);

    try {
      // Fetch leads for this partner in selected month
      const { data: contactOrgs } = await supabase
        .from('contact_organizations')
        .select('contact_id')
        .eq('organization_id', partner.id);

      if (contactOrgs && contactOrgs.length > 0) {
        const contactIds = contactOrgs.map(co => co.contact_id);
        const [year, month] = selectedMonth.split('-').map(Number);
        const startDate = new Date(year, month - 2, 1);
        const endDate = new Date(year, month - 1, 0);

        const { data: contacts } = await supabase
          .from('contacts')
          .select(`
            id, name, email, phone, address, postal_code, interest, date_sent,
            opener:profiles!contacts_opener_id_fkey(full_name)
          `)
          .in('id', contactIds)
          .gte('date_sent', format(startDate, 'yyyy-MM-dd'))
          .lte('date_sent', format(endDate, 'yyyy-MM-dd'))
          .order('date_sent', { ascending: false });

        if (contacts) {
          setLeads(contacts.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            address: c.address,
            postal_code: c.postal_code,
            interest: c.interest,
            date_sent: c.date_sent,
            opener_name: (c.opener as any)?.full_name || null,
          })));
        }
      }

      // Fetch sales stats for close rate
      const { data: sales } = await supabase
        .from('sales')
        .select('pipeline_status')
        .eq('organization_id', partner.id);

      if (sales) {
        const totalDeals = sales.length;
        const wonDeals = sales.filter(s => s.pipeline_status === 'won').length;
        const closeRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;
        setSalesStats({ totalDeals, wonDeals, closeRate });
      }
    } finally {
      setLoading(false);
    }
  };

  const getInterestIcon = (interest: string) => {
    switch (interest) {
      case 'sun':
        return <Sun className="w-4 h-4 text-amber-500" />;
      case 'battery':
        return <Battery className="w-4 h-4 text-emerald-500" />;
      case 'sun_battery':
        return (
          <div className="flex items-center gap-0.5">
            <Sun className="w-4 h-4 text-amber-500" />
            <span className="text-xs">+</span>
            <Battery className="w-4 h-4 text-emerald-500" />
          </div>
        );
      default:
        return null;
    }
  };

  const getLeadPrice = (interest: string) => {
    if (!partner) return 0;
    switch (interest) {
      case 'sun': return partner.pricePerSolar;
      case 'battery': return partner.pricePerBattery;
      case 'sun_battery': return partner.pricePerSolar + partner.pricePerBattery;
      default: return 0;
    }
  };

  const totalValue = leads.reduce((sum, lead) => sum + getLeadPrice(lead.interest), 0);
  const solarLeads = leads.filter(l => l.interest === 'sun').length;
  const batteryLeads = leads.filter(l => l.interest === 'battery').length;
  const sunBatteryLeads = leads.filter(l => l.interest === 'sun_battery').length;

  const billingDate = new Date(selectedMonth + '-01');
  const leadsMonthLabel = format(new Date(billingDate.getFullYear(), billingDate.getMonth() - 1, 1), 'MMMM yyyy', { locale: sv });

  const handleCopyTable = () => {
    const headers = ['Datum', 'Namn', 'E-post', 'Telefon', 'Adress', 'Postnummer', 'Typ', 'Opener', 'Pris'];
    const rows = leads.map(lead => [
      format(new Date(lead.date_sent), 'yyyy-MM-dd'),
      lead.name || '',
      lead.email,
      lead.phone || '',
      lead.address || '',
      lead.postal_code || '',
      lead.interest === 'sun' ? 'Sol' : lead.interest === 'battery' ? 'Batteri' : 'Sol+Batteri',
      lead.opener_name || '',
      getLeadPrice(lead.interest).toString(),
    ]);
    
    const tableText = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tableText);
    toast.success('Tabell kopierad till urklipp');
  };

  const handleExportCSV = () => {
    const headers = ['Datum', 'Namn', 'E-post', 'Telefon', 'Adress', 'Postnummer', 'Typ', 'Opener', 'Pris'];
    const rows = leads.map(lead => [
      format(new Date(lead.date_sent), 'yyyy-MM-dd'),
      lead.name || '',
      lead.email,
      lead.phone || '',
      lead.address || '',
      lead.postal_code || '',
      lead.interest === 'sun' ? 'Sol' : lead.interest === 'battery' ? 'Batteri' : 'Sol+Batteri',
      lead.opener_name || '',
      getLeadPrice(lead.interest).toString(),
    ]);
    
    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `faktureringsunderlag_${partner?.name}_${selectedMonth}.csv`;
    link.click();
    toast.success('Exporterad till CSV');
  };

  if (!partner) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {partner.name}
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {partner.contact_person_name && (
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {partner.contact_person_name}
              </span>
            )}
            {partner.contact_phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-4 h-4" />
                {partner.contact_phone}
              </span>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Översikt
            </TabsTrigger>
            <TabsTrigger value="invoicing" className="gap-2">
              <FileText className="w-4 h-4" />
              Fakturering
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Clock className="w-4 h-4" />
              Tidslinje
            </TabsTrigger>
            <TabsTrigger value="coverage" className="gap-2">
              <MapPin className="w-4 h-4" />
              Täckning
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto">
            <TabsContent value="overview" className="mt-0 h-full">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Stats cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-primary" />
                          <span className="text-sm text-muted-foreground">Totala leads</span>
                        </div>
                        <p className="text-2xl font-bold text-primary">{leads.length}</p>
                        <p className="text-xs text-muted-foreground">{leadsMonthLabel}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-emerald-500/5 border-emerald-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm text-muted-foreground">Close rate</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600">{salesStats.closeRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">{salesStats.wonDeals}/{salesStats.totalDeals} deals</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-amber-500/5 border-amber-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Sun className="w-4 h-4 text-amber-500" />
                          <span className="text-sm text-muted-foreground">Sol-leads</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-600">{solarLeads + sunBatteryLeads}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-emerald-500/5 border-emerald-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Battery className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm text-muted-foreground">Batteri-leads</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600">{batteryLeads + sunBatteryLeads}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Value summary */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Att fakturera för {leadsMonthLabel}</p>
                          <p className="text-3xl font-bold text-primary">{totalValue.toLocaleString('sv-SE')} kr</p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>Sol: {partner.pricePerSolar.toLocaleString('sv-SE')} kr/st</p>
                          <p>Batteri: {partner.pricePerBattery.toLocaleString('sv-SE')} kr/st</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="invoicing" className="mt-0 h-full">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Inga leads hittades för denna period
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Export buttons */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Leads från {leadsMonthLabel}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopyTable}>
                        <Copy className="w-4 h-4 mr-1" />
                        Kopiera tabell
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportCSV}>
                        <Download className="w-4 h-4 mr-1" />
                        Exportera CSV
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <ResizableTableHead>Datum</ResizableTableHead>
                          <ResizableTableHead>Kund</ResizableTableHead>
                          <ResizableTableHead>Kontakt</ResizableTableHead>
                          <ResizableTableHead>Typ</ResizableTableHead>
                          <ResizableTableHead>Opener</ResizableTableHead>
                          <ResizableTableHead className="text-right">Pris</ResizableTableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leads.map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell className="text-sm">
                              {format(new Date(lead.date_sent), 'd MMM', { locale: sv })}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <p className="font-medium">{lead.name || 'Okänd'}</p>
                                {lead.address && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {lead.address} {lead.postal_code}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5 text-sm">
                                <p className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-muted-foreground" />
                                  {lead.email}
                                </p>
                                {lead.phone && (
                                  <p className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-muted-foreground" />
                                    {lead.phone}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="gap-1">
                                {getInterestIcon(lead.interest)}
                                {lead.interest === 'sun' && 'Sol'}
                                {lead.interest === 'battery' && 'Batteri'}
                                {lead.interest === 'sun_battery' && 'Sol+Batteri'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <User className="w-3 h-3" />
                                {lead.opener_name || 'Okänd'}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {getLeadPrice(lead.interest).toLocaleString('sv-SE')} kr
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        Totalt {leads.length} leads
                      </div>
                      <div className="text-lg font-bold text-primary">
                        Att fakturera: {totalValue.toLocaleString('sv-SE')} kr
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="mt-0 h-full">
              <PartnerTimelineTab 
                partnerId={partner.id} 
                collaborationStartDate={partner.collaboration_start_date || null}
              />
            </TabsContent>

            <TabsContent value="coverage" className="mt-0 h-full">
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-8 text-center">
                    <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <h4 className="font-medium mb-2">Täckningsområde</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Kartvy över partnerens täckningsområde kommer snart.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Detta kräver en Mapbox-nyckel för att visa kartor.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
