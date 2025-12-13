import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { InterestBadge } from '@/components/ui/interest-badge';
import { Search, Filter, FileText } from 'lucide-react';
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

  useEffect(() => {
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;

    try {
      // Fetch organizations
      const { data: orgsData } = await supabase
        .from('organizations')
        .select('id, name');
      setOrganizations(orgsData || []);

      // Fetch contacts based on role
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

      // Transform data
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Laddar deals...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Deals</h1>
          <p className="text-muted-foreground mt-1">
            Hantera och följ upp dina affärer
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="w-4 h-4" />
          <span>{filteredContacts.length} deals</span>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Sök på e-post, telefon eller adress..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterOrg} onValueChange={setFilterOrg}>
                <SelectTrigger className="w-48">
                  <Filter className="w-4 h-4 mr-2" />
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
                <SelectTrigger className="w-40">
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
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>E-post</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Intresse</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Opener</TableHead>
                  <TableHead>Kredit Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Inga deals hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => {
                    const creditStatus = getLatestCreditStatus(contact);
                    return (
                      <TableRow key={contact.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">{contact.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact.phone || '-'}
                        </TableCell>
                        <TableCell>
                          <InterestBadge interest={contact.interest} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(contact.date_sent), 'dd MMM yyyy', { locale: sv })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact.opener?.full_name || contact.opener?.email || '-'}
                        </TableCell>
                        <TableCell>
                          {creditStatus ? (
                            <StatusBadge status={creditStatus} />
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Deals;