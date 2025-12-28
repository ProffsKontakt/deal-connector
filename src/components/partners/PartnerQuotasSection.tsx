import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ResizableTableHead } from '@/components/ui/resizable-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Target, Save, History, Building2, ChevronDown } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  status: 'active' | 'archived';
}

interface Quota {
  id?: string;
  organization_id: string;
  period_start: string;
  quota_amount: number;
  updated_at?: string;
}

interface QuotaChange {
  id: string;
  changed_at: string;
  action: string;
  changed_by: string | null;
  old_values: { quota_amount?: number } | null;
  new_values: { quota_amount?: number; organization_id?: string } | null;
}

interface PartnerQuotasSectionProps {
  selectedMonth: string;
}

export function PartnerQuotasSection({ selectedMonth }: PartnerQuotasSectionProps) {
  const { profile } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [originalQuotas, setOriginalQuotas] = useState<Record<string, number>>({});
  const [recentChanges, setRecentChanges] = useState<QuotaChange[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // The quota period is the selected month
  const selectedDate = new Date(selectedMonth + '-01');
  const quotaPeriodStart = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
  const quotaPeriodLabel = format(selectedDate, 'MMMM yyyy', { locale: sv });

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch active organizations
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, status')
        .eq('status', 'active')
        .order('name');

      if (orgs) {
        setOrganizations(orgs);
      }

      // Fetch quotas for this period
      const { data: quotaData } = await supabase
        .from('organization_lead_quotas')
        .select('*')
        .eq('period_type', 'monthly')
        .eq('period_start', quotaPeriodStart);

      const quotaMap: Record<string, number> = {};
      quotaData?.forEach(q => {
        quotaMap[q.organization_id] = q.quota_amount;
      });
      setQuotas(quotaMap);
      setOriginalQuotas(quotaMap);

      // Fetch recent quota changes from audit log
      const { data: changes } = await supabase
        .from('audit_log')
        .select('id, changed_at, action, changed_by, old_values, new_values')
        .eq('table_name', 'organization_lead_quotas')
        .order('changed_at', { ascending: false })
        .limit(10);

      if (changes) {
        setRecentChanges(changes as QuotaChange[]);
        
        // Fetch user names for changed_by ids
        const userIds = changes.filter(c => c.changed_by).map(c => c.changed_by!);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);
          
          if (profiles) {
            const nameMap: Record<string, string> = {};
            profiles.forEach(p => {
              nameMap[p.id] = p.full_name || p.email;
            });
            setUserNames(nameMap);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuotaChange = (orgId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setQuotas(prev => ({ ...prev, [orgId]: numValue }));
  };

  const saveQuota = async (orgId: string) => {
    if (!profile?.id) return;
    
    setSaving(orgId);
    try {
      const quotaAmount = quotas[orgId] || 0;
      
      const { error } = await supabase
        .from('organization_lead_quotas')
        .upsert({
          organization_id: orgId,
          period_type: 'monthly',
          period_start: quotaPeriodStart,
          quota_amount: quotaAmount,
          created_by: profile.id,
        }, {
          onConflict: 'organization_id,period_type,period_start',
        });

      if (error) throw error;

      setOriginalQuotas(prev => ({ ...prev, [orgId]: quotaAmount }));
      toast.success('Kvot sparad');
      
      // Refresh changes
      const { data: changes } = await supabase
        .from('audit_log')
        .select('id, changed_at, action, changed_by, old_values, new_values')
        .eq('table_name', 'organization_lead_quotas')
        .order('changed_at', { ascending: false })
        .limit(10);
      
      if (changes) {
        setRecentChanges(changes as QuotaChange[]);
        
        // Update user names
        const userIds = changes.filter(c => c.changed_by).map(c => c.changed_by!);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);
          
          if (profiles) {
            const nameMap: Record<string, string> = { ...userNames };
            profiles.forEach(p => {
              nameMap[p.id] = p.full_name || p.email;
            });
            setUserNames(nameMap);
          }
        }
      }
    } catch (error: any) {
      toast.error('Kunde inte spara kvot: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const hasUnsavedChanges = (orgId: string) => {
    return quotas[orgId] !== originalQuotas[orgId];
  };

  const totalQuota = Object.values(quotas).reduce((sum, q) => sum + (q || 0), 0);
  const orgsWithQuota = Object.values(quotas).filter(q => q > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Target className="w-4 h-4" />
              Period
            </div>
            <p className="text-xl font-bold mt-1 capitalize">{quotaPeriodLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Building2 className="w-4 h-4" />
              Partners med kvot
            </div>
            <p className="text-xl font-bold mt-1">
              {orgsWithQuota} <span className="text-sm font-normal text-muted-foreground">av {organizations.length}</span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Target className="w-4 h-4 text-primary" />
              Total kvot
            </div>
            <p className="text-xl font-bold mt-1 text-primary">{totalQuota} leads</p>
          </CardContent>
        </Card>
      </div>

      {/* Quotas Table */}
      {organizations.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Inga aktiva partners"
          description="Det finns inga aktiva partners att ställa in kvoter för"
        />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <ResizableTableHead className="font-semibold">Partner</ResizableTableHead>
                <ResizableTableHead className="font-semibold w-40">Kvot (leads)</ResizableTableHead>
                <ResizableTableHead className="font-semibold w-24">Åtgärd</ResizableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{org.name}</p>
                      {hasUnsavedChanges(org.id) && (
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">
                          Ej sparad
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={quotas[org.id] || ''}
                      onChange={(e) => handleQuotaChange(org.id, e.target.value)}
                      placeholder="0"
                      className="w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={hasUnsavedChanges(org.id) ? 'default' : 'ghost'}
                      disabled={!hasUnsavedChanges(org.id) || saving === org.id}
                      onClick={() => saveQuota(org.id)}
                    >
                      {saving === org.id ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Recent Changes - Collapsible */}
      {recentChanges.length > 0 && (
        <CollapsibleChanges 
          changes={recentChanges} 
          organizations={organizations}
          userNames={userNames}
        />
      )}
    </div>
  );
}

interface CollapsibleChangesProps {
  changes: QuotaChange[];
  organizations: Organization[];
  userNames: Record<string, string>;
}

function CollapsibleChanges({ changes, organizations, userNames }: CollapsibleChangesProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="font-medium mb-3 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        <History className="w-4 h-4" />
        Senaste ändringar ({changes.length})
      </button>
      {isOpen && (
        <div className="space-y-2 max-h-64 overflow-y-auto pl-6">
          {changes.map((change) => {
            const oldQuota = change.old_values?.quota_amount;
            const newQuota = change.new_values?.quota_amount;
            const orgId = change.new_values?.organization_id;
            const org = organizations.find(o => o.id === orgId);
            const userName = change.changed_by ? userNames[change.changed_by] : null;
            
            return (
              <div key={change.id} className="text-sm flex items-center gap-2 text-muted-foreground">
                <span className="text-xs">
                  {format(parseISO(change.changed_at), 'dd MMM HH:mm', { locale: sv })}
                </span>
                <span>•</span>
                <span>
                  {org?.name || 'Okänd partner'}:{' '}
                  {change.action === 'INSERT' ? (
                    <span className="text-success">satte kvot till {newQuota}</span>
                  ) : (
                    <span>
                      ändrade från {oldQuota ?? 0} till{' '}
                      <span className="text-foreground font-medium">{newQuota}</span>
                    </span>
                  )}
                </span>
                {userName && (
                  <>
                    <span>•</span>
                    <span className="text-xs italic">av {userName}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
