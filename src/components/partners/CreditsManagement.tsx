import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ResizableTableHead } from '@/components/ui/resizable-table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isAfter, isBefore, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Inbox, Check, X, AlertTriangle, Info } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type CreditStatus = Database['public']['Enums']['credit_status'];

interface CreditRequest {
  id: string;
  status: CreditStatus;
  reason: string | null;
  created_at: string;
  contact: { email: string; name: string | null; date_sent: string } | null;
  organization: { name: string } | null;
  requested_by_profile: { email: string } | null;
}

interface CreditsManagementProps {
  selectedMonth: string; // Format: 'yyyy-MM' (billing month)
  onUpdate?: () => void;
}

export function CreditsManagement({ selectedMonth, onUpdate }: CreditsManagementProps) {
  const [creditRequests, setCreditRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreditRequests();
  }, [selectedMonth]);

  const fetchCreditRequests = async () => {
    try {
      // Parse the selected month - this IS the leads month (not billing month)
      const selectedDate = new Date(selectedMonth + '-01');
      
      // Leads generated in the selected month
      const leadsMonthStart = startOfMonth(selectedDate);
      const leadsMonthEnd = endOfMonth(selectedDate);
      
      // Credits must be requested BEFORE the 1st of the next month to avoid being billed
      // If requested AFTER, they'll be deducted next month (we still show them but mark differently)
      const billingCutoff = startOfMonth(addMonths(selectedDate, 1));

      const { data, error } = await supabase
        .from('credit_requests')
        .select(`
          *,
          contact:contacts(email, name, date_sent),
          organization:organizations(name),
          requested_by_profile:profiles!credit_requests_requested_by_fkey(email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter credits based on billing logic:
      // Show credits where:
      // 1. The lead (contact.date_sent) was generated in the leads month (month before billing)
      // 2. OR the credit was requested in the previous month but approved late (deferred credits)
      const filteredCredits = (data as CreditRequest[] || []).filter(request => {
        if (!request.contact?.date_sent) return false;
        
        const leadDate = parseISO(request.contact.date_sent);
        const creditRequestDate = parseISO(request.created_at);
        
        // Case 1: Lead was generated in the leads month
        const leadInPeriod = !isBefore(leadDate, leadsMonthStart) && !isAfter(leadDate, leadsMonthEnd);
        
        if (leadInPeriod) return true;
        
        // Case 2: Deferred credit - lead from previous period, credit requested after billing cutoff
        // These would be deducted from THIS month's invoice
        const previousLeadsStart = startOfMonth(subMonths(leadsMonthStart, 1));
        const previousLeadsEnd = endOfMonth(subMonths(leadsMonthStart, 1));
        const previousBillingCutoff = startOfMonth(selectedDate);
        
        const leadInPreviousPeriod = !isBefore(leadDate, previousLeadsStart) && !isAfter(leadDate, previousLeadsEnd);
        const creditRequestedAfterPreviousCutoff = isAfter(creditRequestDate, previousBillingCutoff);
        
        if (leadInPreviousPeriod && creditRequestedAfterPreviousCutoff && request.status === 'approved') {
          return true; // This is a deferred credit to be deducted this month
        }
        
        return false;
      });

      setCreditRequests(filteredCredits);
    } finally {
      setLoading(false);
    }
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
    fetchCreditRequests();
    onUpdate?.();
  };

  // Calculate if a credit is deferred (will be deducted next month)
  const isDeferredCredit = (request: CreditRequest): boolean => {
    if (!request.contact?.date_sent) return false;
    
    const selectedDate = new Date(selectedMonth + '-01');
    const leadsMonthStart = startOfMonth(selectedDate);
    const leadDate = parseISO(request.contact.date_sent);
    
    return isBefore(leadDate, leadsMonthStart);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedDate = new Date(selectedMonth + '-01');
  const leadsMonthLabel = format(selectedDate, 'MMMM yyyy', { locale: sv });

  if (creditRequests.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Visar kreditförfrågningar för leads genererade i <span className="font-medium">{leadsMonthLabel}</span>
        </p>
        <EmptyState
          icon={Inbox}
          title="Inga kreditbegäranden"
          description={`Det finns inga kreditförfrågningar för ${leadsMonthLabel}`}
        />
      </div>
    );
  }

  const pendingRequests = creditRequests.filter(r => r.status === 'pending');
  const handledRequests = creditRequests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Visar kreditförfrågningar för leads genererade i <span className="font-medium">{leadsMonthLabel}</span>
        </p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Krediter måste begäras inom 14 dagar från att leadet skapades, och före den 1:a i faktureringsmånaden.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {pendingRequests.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Väntande ({pendingRequests.length})
          </h4>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <ResizableTableHead className="font-semibold">Kontakt</ResizableTableHead>
                  <ResizableTableHead className="font-semibold">Partner</ResizableTableHead>
                  <ResizableTableHead className="font-semibold">Lead-datum</ResizableTableHead>
                  <ResizableTableHead className="font-semibold">Anledning</ResizableTableHead>
                  <ResizableTableHead className="font-semibold">Begäran</ResizableTableHead>
                  <ResizableTableHead className="w-28 font-semibold">Åtgärder</ResizableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => {
                  const isDeferred = isDeferredCredit(request);
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.contact?.name || 'Okänd'}</p>
                          <p className="text-xs text-muted-foreground">{request.contact?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {request.organization?.name || '–'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {request.contact?.date_sent ? format(parseISO(request.contact.date_sent), 'dd MMM yyyy', { locale: sv }) : '–'}
                          </span>
                          {isDeferred && (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">
                              Uppskjuten
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {request.reason || '–'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(parseISO(request.created_at), 'dd MMM yyyy', { locale: sv })}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {handledRequests.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 text-muted-foreground">
            Hanterade ({handledRequests.length})
          </h4>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <ResizableTableHead className="font-semibold">Kontakt</ResizableTableHead>
                  <ResizableTableHead className="font-semibold">Partner</ResizableTableHead>
                  <ResizableTableHead className="font-semibold">Lead-datum</ResizableTableHead>
                  <ResizableTableHead className="font-semibold">Anledning</ResizableTableHead>
                  <ResizableTableHead className="font-semibold">Begäran</ResizableTableHead>
                  <ResizableTableHead className="font-semibold">Status</ResizableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {handledRequests.slice(0, 10).map((request) => {
                  const isDeferred = isDeferredCredit(request);
                  return (
                    <TableRow key={request.id} className="opacity-60">
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.contact?.name || 'Okänd'}</p>
                          <p className="text-xs text-muted-foreground">{request.contact?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {request.organization?.name || '–'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {request.contact?.date_sent ? format(parseISO(request.contact.date_sent), 'dd MMM yyyy', { locale: sv }) : '–'}
                          </span>
                          {isDeferred && (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">
                              Uppskjuten
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {request.reason || '–'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(parseISO(request.created_at), 'dd MMM yyyy', { locale: sv })}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={request.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
