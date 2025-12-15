import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { InterestBadge } from '@/components/ui/interest-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CreateDealDialog } from '@/components/deals/CreateDealDialog';
import { DealDetailsDialog } from '@/components/deals/DealDetailsDialog';
import { Search, Filter, FileText, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface Contact {
  id: string;
  email: string;
  phone: string | null;
  address: string | null;
  date_sent: string;
  interest: 'sun' | 'battery' | 'sun_battery';
  opener_id: string;
  opener?: { email: string; full_name: string | null };
  organizations?: { id: string; name: string }[];
  credit_requests?: { status: 'pending' | 'approved' | 'denied'; organization_id: string }[];
}

interface Organization {
  id: string;
  name: string;
}

const Deals = () => {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;

    try {
      const { data: orgsData } = await supabase
        .from('organizations')
        .select('id, name');
      setOrganizations(orgsData || []);

      let query = supabase
        .from('contacts')
        .select(`
          *,
          opener:profiles!contacts_opener_id_fkey(email, full_name),
          contact_organizations(organization:organizations(id, name)),
          credit_requests(status, organization_id)
        `)
        .order('date_sent', { ascending: false });

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching contacts:', error);
        return;
      }

      const transformed = (data || []).map((c: any) => ({
        ...c,
        organizations: c.contact_organizations?.map((co: any) => co.organization) || [],
      }));

      setContacts(transformed);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch = 
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.address?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOrg = filterOrg === 'all' || 
      contact.organizations?.some(o => o.id === filterOrg);

    const matchesStatus = filterStatus === 'all' ||
      contact.credit_requests?.some(cr => cr.status === filterStatus);

    return matchesSearch && matchesOrg && matchesStatus;
  });

  const getLatestCreditStatus = (contact: Contact) => {
    if (!contact.credit_requests || contact.credit_requests.length === 0) return null;
    return contact.credit_requests[0].status;
  };

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    setDetailsOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground text-sm">Laddar deals...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <h1 className="page-title">Deals</h1>
          </div>
          <p className="page-description">
            Hantera och följ upp dina affärer
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span className="font-medium">{filteredContacts.length}</span>
            <span>deals</span>
          </div>
          {(profile?.role === 'admin' || profile?.role === 'opener') && (
            <CreateDealDialog onDealCreated={fetchData} />
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Sök på e-post, telefon eller adress..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <div className="flex gap-3">
              <Select value={filterOrg} onValueChange={setFilterOrg}>
                <SelectTrigger className="w-52 h-11">
                  <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Organisation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla organisationer</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-44 h-11">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla status</SelectItem>
                  <SelectItem value="pending">Väntande</SelectItem>
                  <SelectItem value="approved">Godkänd</SelectItem>
                  <SelectItem value="denied">Nekad</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredContacts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Inga deals hittades"
              description={searchTerm || filterOrg !== 'all' || filterStatus !== 'all' 
                ? "Prova att justera dina filter för att hitta det du söker"
                : "Det finns inga deals att visa ännu"}
            />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">E-post</TableHead>
                    <TableHead className="font-semibold">Telefon</TableHead>
                    <TableHead className="font-semibold">Intresse</TableHead>
                    <TableHead className="font-semibold">Datum</TableHead>
                    <TableHead className="font-semibold">Opener</TableHead>
                    <TableHead className="font-semibold">Kredit Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => {
                    const creditStatus = getLatestCreditStatus(contact);
                    return (
                      <TableRow 
                        key={contact.id} 
                        className="cursor-pointer transition-colors hover:bg-muted/50 group"
                        onClick={() => handleContactClick(contact)}
                      >
                        <TableCell className="font-medium group-hover:text-primary transition-colors">
                          {contact.email}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact.phone || '–'}
                        </TableCell>
                        <TableCell>
                          <InterestBadge interest={contact.interest} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(contact.date_sent), 'dd MMM yyyy', { locale: sv })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact.opener?.full_name || contact.opener?.email || '–'}
                        </TableCell>
                        <TableCell>
                          {creditStatus ? (
                            <StatusBadge status={creditStatus} />
                          ) : (
                            <span className="text-muted-foreground text-sm">–</span>
                          )}
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

      <DealDetailsDialog
        contact={selectedContact}
        organizations={organizations}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onDealUpdated={fetchData}
      />
    </div>
  );
};

export default Deals;