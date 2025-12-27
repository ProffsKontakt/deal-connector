import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ResizableTableHead } from '@/components/ui/resizable-table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Inbox, Check, X } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type CreditStatus = Database['public']['Enums']['credit_status'];

interface CreditRequest {
  id: string;
  status: CreditStatus;
  reason: string | null;
  created_at: string;
  contact: { email: string; name: string | null } | null;
  organization: { name: string } | null;
  requested_by_profile: { email: string } | null;
}

interface CreditsManagementProps {
  onUpdate?: () => void;
}

export function CreditsManagement({ onUpdate }: CreditsManagementProps) {
  const [creditRequests, setCreditRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreditRequests();
  }, []);

  const fetchCreditRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_requests')
        .select(`
          *,
          contact:contacts(email, name),
          organization:organizations(name),
          requested_by_profile:profiles!credit_requests_requested_by_fkey(email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCreditRequests(data as CreditRequest[] || []);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (creditRequests.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Inga kreditbegäranden"
        description="Det finns inga kreditförfrågningar att hantera just nu"
      />
    );
  }

  const pendingRequests = creditRequests.filter(r => r.status === 'pending');
  const handledRequests = creditRequests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
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
                  <ResizableTableHead className="font-semibold">Anledning</ResizableTableHead>
                  <ResizableTableHead className="font-semibold">Datum</ResizableTableHead>
                  <ResizableTableHead className="w-28 font-semibold">Åtgärder</ResizableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
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
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {request.reason || '–'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(request.created_at), 'dd MMM yyyy', { locale: sv })}
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
                ))}
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
                  <ResizableTableHead className="font-semibold">Anledning</ResizableTableHead>
                  <ResizableTableHead className="font-semibold">Datum</ResizableTableHead>
                  <ResizableTableHead className="font-semibold">Status</ResizableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {handledRequests.slice(0, 10).map((request) => (
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
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {request.reason || '–'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(request.created_at), 'dd MMM yyyy', { locale: sv })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
