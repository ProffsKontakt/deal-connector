import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, TrendingUp, Calendar, ChevronLeft, ChevronRight, Percent, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { sv } from 'date-fns/locale';

interface LeadDetail {
  id: string;
  email: string;
  interest: string;
  date_sent: string;
  organizations: string[];
  commission: number;
}

interface SaleDetail {
  id: string;
  contactEmail: string;
  organizationName: string;
  closedAt: string;
  commission: number;
  invoiceableAmount: number;
}

interface OpenerSalaryData {
  id: string;
  name: string;
  email: string;
  qualifiedLeads: number;
  commission: number;
  commissionPerDeal: number;
  leads: LeadDetail[];
}

interface CloserSalaryData {
  id: string;
  name: string;
  email: string;
  closedDeals: number;
  commission: number;
  baseCommission: number;
  sales: SaleDetail[];
}

interface EmployerCostSettings {
  percentage: number;
  name: string;
}

export const SalariesView = () => {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [openerSalaries, setOpenerSalaries] = useState<OpenerSalaryData[]>([]);
  const [closerSalaries, setCloserSalaries] = useState<CloserSalaryData[]>([]);
  const [employerCost, setEmployerCost] = useState<EmployerCostSettings | null>(null);
  const [selectedOpener, setSelectedOpener] = useState<OpenerSalaryData | null>(null);
  const [selectedCloser, setSelectedCloser] = useState<CloserSalaryData | null>(null);

  const handlePreviousMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));

  useEffect(() => {
    fetchSalaries();
  }, [selectedMonth]);

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const startDate = startOfMonth(selectedMonth);
      const endDate = endOfMonth(selectedMonth);

      // Fetch employer cost settings
      const { data: costSettings } = await supabase
        .from('employer_cost_settings')
        .select('percentage, name')
        .eq('is_active', true)
        .single();
      
      setEmployerCost(costSettings);

      // Fetch all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, opener_commission_per_deal, closer_base_commission')
        .in('role', ['opener', 'closer', 'teamleader']);

      // Fetch contacts for the month (for opener commission)
      const { data: contacts } = await supabase
        .from('contacts')
        .select(`
          id, 
          email, 
          opener_id, 
          interest, 
          date_sent,
          contact_organizations(organization:organizations(id, name)),
          credit_requests(status, organization_id)
        `)
        .gte('date_sent', startDate.toISOString().split('T')[0])
        .lte('date_sent', endDate.toISOString().split('T')[0]);

      // Fetch closed sales for the month (for closer commission)
      const { data: sales } = await supabase
        .from('sales')
        .select(`
          id, 
          closer_id, 
          closer_commission, 
          opener_commission,
          contact_id, 
          organization_id,
          invoiceable_amount,
          closed_at,
          contact:contacts(email, opener_id),
          organization:organizations(name)
        `)
        .eq('pipeline_status', 'closed_won')
        .gte('closed_at', startDate.toISOString())
        .lte('closed_at', endDate.toISOString());

      // Calculate opener salaries
      // Rule: Opener only gets commission if lead was sold to 2+ companies
      const openers = profiles?.filter(p => p.role === 'opener' || p.role === 'teamleader') || [];
      const openerData: OpenerSalaryData[] = openers.map(opener => {
        const openerContacts = contacts?.filter(c => c.opener_id === opener.id) || [];
        
        // Filter to only leads sold to 2+ organizations (non-credited)
        const qualifiedLeads = openerContacts.filter(contact => {
          const orgs = contact.contact_organizations?.map((co: any) => co.organization) || [];
          
          // Count organizations that don't have approved credit
          const validOrgs = orgs.filter((org: any) => {
            const hasApprovedCredit = contact.credit_requests?.some(
              (cr: any) => cr.organization_id === org.id && cr.status === 'approved'
            );
            return !hasApprovedCredit;
          });
          
          return validOrgs.length >= 2;
        });

        const commissionPerDeal = opener.opener_commission_per_deal || 1000;
        const totalCommission = qualifiedLeads.length * commissionPerDeal;

        const leads: LeadDetail[] = qualifiedLeads.map(contact => ({
          id: contact.id,
          email: contact.email,
          interest: contact.interest,
          date_sent: contact.date_sent,
          organizations: contact.contact_organizations?.map((co: any) => co.organization?.name).filter(Boolean) || [],
          commission: commissionPerDeal
        }));

        return {
          id: opener.id,
          name: opener.full_name || opener.email,
          email: opener.email,
          qualifiedLeads: qualifiedLeads.length,
          commission: totalCommission,
          commissionPerDeal,
          leads
        };
      });

      // Calculate closer salaries
      const closers = profiles?.filter(p => p.role === 'closer') || [];
      const closerData: CloserSalaryData[] = closers.map(closer => {
        const closerSales = sales?.filter(s => s.closer_id === closer.id) || [];
        const totalCommission = closerSales.reduce((sum, s) => sum + (Number(s.closer_commission) || 0), 0);

        const salesDetails: SaleDetail[] = closerSales.map(sale => ({
          id: sale.id,
          contactEmail: (sale.contact as any)?.email || 'Okänd',
          organizationName: (sale.organization as any)?.name || 'Okänd',
          closedAt: sale.closed_at || '',
          commission: Number(sale.closer_commission) || 0,
          invoiceableAmount: Number(sale.invoiceable_amount) || 0
        }));

        return {
          id: closer.id,
          name: closer.full_name || closer.email,
          email: closer.email,
          closedDeals: closerSales.length,
          commission: totalCommission,
          baseCommission: closer.closer_base_commission || 8000,
          sales: salesDetails
        };
      });

      setOpenerSalaries(openerData);
      setCloserSalaries(closerData);
    } catch (error) {
      console.error('Error fetching salaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);
  };

  const totalOpenerCommission = useMemo(() => 
    openerSalaries.reduce((sum, s) => sum + s.commission, 0), 
    [openerSalaries]
  );
  
  const totalCloserCommission = useMemo(() => 
    closerSalaries.reduce((sum, s) => sum + s.commission, 0), 
    [closerSalaries]
  );

  const totalCommission = totalOpenerCommission + totalCloserCommission;
  const employerCostAmount = employerCost ? (totalCommission * employerCost.percentage / 100) : 0;
  const totalWithEmployerCost = totalCommission + employerCostAmount;

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Månad:</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="min-w-40 text-center font-medium">
            {format(selectedMonth, 'MMMM yyyy', { locale: sv })}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Closers</p>
                <p className="text-xl font-bold">{formatCurrency(totalCloserCommission)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Openers</p>
                <p className="text-xl font-bold">{formatCurrency(totalOpenerCommission)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Percent className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Arbetsgivaravgift {employerCost ? `(${employerCost.percentage}%)` : ''}
                </p>
                <p className="text-xl font-bold">{formatCurrency(employerCostAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Users className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total kostnad</p>
                <p className="text-xl font-bold">{formatCurrency(totalWithEmployerCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Closers Section */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Closer-löner
              </CardTitle>
              <CardDescription>
                Provisioner för closers baserat på stängda affärer
              </CardDescription>
            </CardHeader>
            <CardContent>
              {closerSalaries.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="Inga closers"
                  description="Det finns inga closers att visa"
                />
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold">Namn</TableHead>
                        <TableHead className="text-center font-semibold">Stängda affärer</TableHead>
                        <TableHead className="text-right font-semibold">Provision</TableHead>
                        <TableHead className="text-right font-semibold">Inkl. arbetsgivaravgift</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closerSalaries.map((closer) => {
                        const withEmployerCost = employerCost 
                          ? closer.commission * (1 + employerCost.percentage / 100) 
                          : closer.commission;
                        return (
                          <TableRow 
                            key={closer.id} 
                            className="hover:bg-muted/30 cursor-pointer"
                            onClick={() => setSelectedCloser(closer)}
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">{closer.name}</p>
                                <p className="text-sm text-muted-foreground">{closer.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {closer.closedDeals}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600">
                              {formatCurrency(closer.commission)}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-muted-foreground">
                              {formatCurrency(withEmployerCost)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Openers Section */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                Opener-löner
              </CardTitle>
              <CardDescription>
                Provisioner för openers baserat på leads sålda till 2+ partners (ej krediterade)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {openerSalaries.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Inga openers"
                  description="Det finns inga openers att visa"
                />
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold">Namn</TableHead>
                        <TableHead className="text-center font-semibold">Kvalificerade leads</TableHead>
                        <TableHead className="text-right font-semibold">Provision/lead</TableHead>
                        <TableHead className="text-right font-semibold">Provision</TableHead>
                        <TableHead className="text-right font-semibold">Inkl. arbetsgivaravgift</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openerSalaries.map((opener) => {
                        const withEmployerCost = employerCost 
                          ? opener.commission * (1 + employerCost.percentage / 100) 
                          : opener.commission;
                        return (
                          <TableRow 
                            key={opener.id} 
                            className="hover:bg-muted/30 cursor-pointer"
                            onClick={() => setSelectedOpener(opener)}
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">{opener.name}</p>
                                <p className="text-sm text-muted-foreground">{opener.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {opener.qualifiedLeads}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatCurrency(opener.commissionPerDeal)}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary">
                              {formatCurrency(opener.commission)}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-muted-foreground">
                              {formatCurrency(withEmployerCost)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Opener Breakdown Dialog */}
      <Dialog open={!!selectedOpener} onOpenChange={() => setSelectedOpener(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Lönespecifikation: {selectedOpener?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedOpener && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Kvalificerade leads</p>
                  <p className="text-2xl font-bold">{selectedOpener.qualifiedLeads}</p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10">
                  <p className="text-sm text-muted-foreground">Total provision</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(selectedOpener.commission)}</p>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>Provision per lead: {formatCurrency(selectedOpener.commissionPerDeal)}</p>
                <p className="text-xs mt-1">* Endast leads sålda till 2+ partners (ej krediterade) ger provision</p>
              </div>

              {selectedOpener.leads.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Lead</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Partners</TableHead>
                        <TableHead className="text-right">Provision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOpener.leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.email}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(lead.date_sent), 'dd MMM yyyy', { locale: sv })}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {lead.organizations.map((org, i) => (
                                <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-muted">
                                  {org}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {formatCurrency(lead.commission)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={Wallet}
                  title="Inga kvalificerade leads"
                  description="Inga leads sålda till 2+ partners denna månad"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Closer Breakdown Dialog */}
      <Dialog open={!!selectedCloser} onOpenChange={() => setSelectedCloser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Lönespecifikation: {selectedCloser?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedCloser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Stängda affärer</p>
                  <p className="text-2xl font-bold">{selectedCloser.closedDeals}</p>
                </div>
                <div className="p-4 rounded-lg bg-emerald-500/10">
                  <p className="text-sm text-muted-foreground">Total provision</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(selectedCloser.commission)}</p>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>Basprovision: {formatCurrency(selectedCloser.baseCommission)}</p>
              </div>

              {selectedCloser.sales.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Kund</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Stängd</TableHead>
                        <TableHead className="text-right">Fakturerbart</TableHead>
                        <TableHead className="text-right">Provision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCloser.sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-medium">{sale.contactEmail}</TableCell>
                          <TableCell className="text-muted-foreground">{sale.organizationName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {sale.closedAt ? format(new Date(sale.closedAt), 'dd MMM yyyy', { locale: sv }) : '–'}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(sale.invoiceableAmount)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">
                            {formatCurrency(sale.commission)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title="Inga stängda affärer"
                  description="Inga affärer stängdes denna månad"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
