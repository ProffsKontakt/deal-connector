import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Wallet, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { sv } from 'date-fns/locale';

interface SalaryData {
  id: string;
  name: string;
  email: string;
  role: 'opener' | 'closer';
  closedDeals: number;
  commission: number;
}

export const SalariesView = () => {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [salaries, setSalaries] = useState<SalaryData[]>([]);

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: sv }),
    };
  });

  useEffect(() => {
    fetchSalaries();
  }, [selectedMonth]);

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));

      // Get all sales for the month
      const { data: sales } = await supabase
        .from('sales')
        .select('closer_id, closer_commission, opener_commission, contact_id, pipeline_status')
        .eq('pipeline_status', 'closed_won')
        .gte('closed_at', startDate.toISOString())
        .lte('closed_at', endDate.toISOString());

      // Get contacts for opener mapping
      const contactIds = sales?.map(s => s.contact_id) || [];
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, opener_id')
        .in('id', contactIds.length > 0 ? contactIds : ['00000000-0000-0000-0000-000000000000']);

      // Get all openers and closers
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, opener_commission_per_deal')
        .in('role', ['opener', 'closer', 'teamleader']);

      const salaryData: SalaryData[] = [];

      // Calculate opener salaries
      const openers = profiles?.filter(p => p.role === 'opener' || p.role === 'teamleader') || [];
      openers.forEach((opener) => {
        const openerContactIds = contacts?.filter(c => c.opener_id === opener.id).map(c => c.id) || [];
        const openerSales = sales?.filter(s => openerContactIds.includes(s.contact_id)) || [];
        const totalCommission = openerSales.reduce((sum, s) => sum + (Number(s.opener_commission) || Number(opener.opener_commission_per_deal) || 1000), 0);

        if (openerSales.length > 0 || true) { // Always show all openers
          salaryData.push({
            id: opener.id,
            name: opener.full_name || opener.email,
            email: opener.email,
            role: 'opener',
            closedDeals: openerSales.length,
            commission: totalCommission,
          });
        }
      });

      // Calculate closer salaries
      const closers = profiles?.filter(p => p.role === 'closer') || [];
      closers.forEach((closer) => {
        const closerSales = sales?.filter(s => s.closer_id === closer.id) || [];
        const totalCommission = closerSales.reduce((sum, s) => sum + (Number(s.closer_commission) || 0), 0);

        salaryData.push({
          id: closer.id,
          name: closer.full_name || closer.email,
          email: closer.email,
          role: 'closer',
          closedDeals: closerSales.length,
          commission: totalCommission,
        });
      });

      setSalaries(salaryData);
    } catch (error) {
      console.error('Error fetching salaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);
  };

  const totalOpenerSalaries = salaries.filter(s => s.role === 'opener').reduce((sum, s) => sum + s.commission, 0);
  const totalCloserSalaries = salaries.filter(s => s.role === 'closer').reduce((sum, s) => sum + s.commission, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Openers</p>
                <p className="text-xl font-bold">{formatCurrency(totalOpenerSalaries)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Closers</p>
                <p className="text-xl font-bold">{formatCurrency(totalCloserSalaries)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Wallet className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Totalt</p>
                <p className="text-xl font-bold">{formatCurrency(totalOpenerSalaries + totalCloserSalaries)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Salaries Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Löner för {format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: sv })}</CardTitle>
          <CardDescription>Översikt av provisioner för säljare</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : salaries.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Inga löner"
              description="Det finns inga provisioner att visa för denna månad"
            />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">Namn</TableHead>
                    <TableHead className="font-semibold">Roll</TableHead>
                    <TableHead className="text-center font-semibold">Stängda affärer</TableHead>
                    <TableHead className="text-right font-semibold">Provision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaries.map((salary) => (
                    <TableRow key={salary.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium">{salary.name}</p>
                          <p className="text-sm text-muted-foreground">{salary.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          salary.role === 'closer' 
                            ? 'bg-emerald-500/10 text-emerald-600' 
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {salary.role === 'closer' ? 'Closer' : 'Opener'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {salary.closedDeals}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatCurrency(salary.commission)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
