import { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from '@/components/ui/table';
import { ResizableTableHead } from '@/components/ui/resizable-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { InterestBadge } from '@/components/ui/interest-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CreateDealDialog } from '@/components/deals/CreateDealDialog';
import { DealDetailsDialog } from '@/components/deals/DealDetailsDialog';
import { AssignToCloserDialog } from '@/components/deals/AssignToCloserDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Search, Filter, FileText, TrendingUp, Calendar, ChevronLeft, ChevronRight, Settings, GripVertical, UserCheck, CreditCard, Check, X, Inbox } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { sv } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type CreditStatus = Database['public']['Enums']['credit_status'];

type ColumnKey = 'name' | 'email' | 'phone' | 'address' | 'postalCode' | 'interest' | 'date' | 'opener' | 'bolag1' | 'bolag2' | 'bolag3' | 'bolag4' | 'totalRevenue' | 'creditStatus' | 'region';

interface ColumnConfig {
  key: ColumnKey;
  label: string;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'name', label: 'Namn' },
  { key: 'email', label: 'E-post' },
  { key: 'phone', label: 'Telefon' },
  { key: 'address', label: 'Adress' },
  { key: 'postalCode', label: 'Postnummer' },
  { key: 'interest', label: 'Intresse' },
  { key: 'date', label: 'Datum' },
  { key: 'opener', label: 'Opener' },
  { key: 'bolag1', label: 'Bolag 1' },
  { key: 'bolag2', label: 'Bolag 2' },
  { key: 'bolag3', label: 'Bolag 3' },
  { key: 'bolag4', label: 'Bolag 4' },
  { key: 'totalRevenue', label: 'Total intäkt' },
  { key: 'region', label: 'Region' },
  { key: 'creditStatus', label: 'Kredit Status' },
];

interface Contact {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  date_sent: string;
  interest: 'sun' | 'battery' | 'sun_battery';
  opener_id: string;
  region_id: string | null;
  opener?: { email: string; full_name: string | null };
  organizations?: { id: string; name: string; price_per_solar_deal: number | null; price_per_battery_deal: number | null; is_sales_consultant?: boolean; sales_consultant_lead_type?: string | null }[];
  credit_requests?: { status: 'pending' | 'approved' | 'denied'; organization_id: string }[];
  region?: { id: string; name: string };
}

interface Organization {
  id: string;
  name: string;
  price_per_solar_deal: number | null;
  price_per_battery_deal: number | null;
  is_sales_consultant?: boolean;
  sales_consultant_lead_type?: string | null;
}

interface PriceHistory {
  organization_id: string;
  price_per_solar_deal: number | null;
  price_per_battery_deal: number | null;
  effective_from: string;
  effective_until: string | null;
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

const Deals = () => {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [creditRequests, setCreditRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterInterest, setFilterInterest] = useState<string>('all');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // Column management with ordering
  const [columnOrder, setColumnOrder] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(['name', 'email', 'phone', 'interest', 'date', 'opener', 'bolag1', 'bolag2', 'bolag3', 'bolag4', 'totalRevenue', 'region', 'creditStatus']));
  
  // Multi-select state
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  
  // Assign dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  
  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handlePreviousMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newOrder = [...columnOrder];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, removed);
    setColumnOrder(newOrder);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;

    try {
      // Fetch organizations with prices
      const { data: orgsData } = await supabase
        .from('organizations')
        .select('id, name, price_per_solar_deal, price_per_battery_deal, is_sales_consultant, sales_consultant_lead_type');
      setOrganizations((orgsData as Organization[]) || []);

      // Fetch regions
      const { data: regionsData } = await supabase
        .from('regions')
        .select('id, name')
        .order('name');
      setRegions(regionsData || []);

      // Fetch price history for accurate historical calculations
      const { data: historyData } = await supabase
        .from('organization_price_history')
        .select('organization_id, price_per_solar_deal, price_per_battery_deal, effective_from, effective_until')
        .order('effective_from', { ascending: false });
      setPriceHistory(historyData || []);

      let query = supabase
        .from('contacts')
        .select(`
          *,
          opener:profiles!contacts_opener_id_fkey(email, full_name),
          contact_organizations(organization:organizations(id, name, price_per_solar_deal, price_per_battery_deal, is_sales_consultant, sales_consultant_lead_type)),
          credit_requests(status, organization_id),
          region:regions(id, name)
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

      // Fetch credit requests for admin
      if (profile?.role === 'admin') {
        const { data: creditsRes } = await supabase
          .from('credit_requests')
          .select(`
            *,
            contact:contacts(email),
            organization:organizations(name),
            requested_by_profile:profiles!credit_requests_requested_by_fkey(email)
          `)
          .order('created_at', { ascending: false });
        setCreditRequests(creditsRes as CreditRequest[] || []);
      }
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
    fetchData();
  };

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch = 
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.postal_code?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOrg = filterOrg === 'all' || 
      contact.organizations?.some(o => o.id === filterOrg);

    const matchesStatus = filterStatus === 'all' ||
      contact.credit_requests?.some(cr => cr.status === filterStatus);

    const matchesInterest = filterInterest === 'all' || contact.interest === filterInterest;

    const matchesRegion = filterRegion === 'all' || contact.region_id === filterRegion;

    // Month filter
    const contactDate = new Date(contact.date_sent);
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const matchesMonth = contactDate >= monthStart && contactDate <= monthEnd;

    return matchesSearch && matchesOrg && matchesStatus && matchesInterest && matchesRegion && matchesMonth;
  });

  // Function to get price for a contact at its date from price history
  const getPriceAtDate = (orgId: string, interest: string, contactDate: Date): number => {
    // Find the price record that was effective at the contact's date
    const priceRecord = priceHistory.find(ph => {
      if (ph.organization_id !== orgId) return false;
      const effectiveFrom = new Date(ph.effective_from);
      const effectiveUntil = ph.effective_until ? new Date(ph.effective_until) : null;
      
      return contactDate >= effectiveFrom && (!effectiveUntil || contactDate < effectiveUntil);
    });

    if (!priceRecord) {
      // Fallback to current org price
      const org = organizations.find(o => o.id === orgId);
      if (!org) return 0;
      
      if (interest === 'sun') return org.price_per_solar_deal || 0;
      if (interest === 'battery') return org.price_per_battery_deal || 0;
      if (interest === 'sun_battery') return (org.price_per_solar_deal || 0) + (org.price_per_battery_deal || 0);
      return 0;
    }

    if (interest === 'sun') return priceRecord.price_per_solar_deal || 0;
    if (interest === 'battery') return priceRecord.price_per_battery_deal || 0;
    if (interest === 'sun_battery') return (priceRecord.price_per_solar_deal || 0) + (priceRecord.price_per_battery_deal || 0);
    return 0;
  };

  // Calculate summary data with proper historical pricing, excluding approved credits
  const summaryData = useMemo(() => {
    let totalValue = 0;
    let creditedValue = 0;
    const orgValues: Record<string, { name: string; value: number; leadCount: number; creditedValue: number; creditedLeads: number }> = {};

    filteredContacts.forEach(contact => {
      const contactDate = new Date(contact.date_sent);
      
      contact.organizations?.forEach(org => {
        const priceForThisLead = getPriceAtDate(org.id, contact.interest, contactDate);
        
        // Check if there's an approved credit for this org on this contact
        const hasApprovedCredit = contact.credit_requests?.some(
          cr => cr.organization_id === org.id && cr.status === 'approved'
        );
        
        if (!orgValues[org.id]) {
          orgValues[org.id] = { name: org.name, value: 0, leadCount: 0, creditedValue: 0, creditedLeads: 0 };
        }
        
        if (hasApprovedCredit) {
          // This lead was credited - don't count towards invoice
          creditedValue += priceForThisLead;
          orgValues[org.id].creditedValue += priceForThisLead;
          orgValues[org.id].creditedLeads += 1;
        } else {
          // Normal lead - counts towards invoice
          totalValue += priceForThisLead;
          orgValues[org.id].value += priceForThisLead;
        }
        orgValues[org.id].leadCount += 1;
      });
    });

    return {
      totalValue,
      creditedValue,
      orgValues: Object.values(orgValues),
      totalLeads: filteredContacts.length,
      totalOrgLinks: filteredContacts.reduce((sum, c) => sum + (c.organizations?.length || 0), 0)
    };
  }, [filteredContacts, priceHistory, organizations]);

  const getLatestCreditStatus = (contact: Contact) => {
    if (!contact.credit_requests || contact.credit_requests.length === 0) return null;
    return contact.credit_requests[0].status;
  };

  // Calculate total revenue for a single contact based on its assigned organizations
  // Excludes organizations where we are sales consultant for matching lead type
  const getContactTotalRevenue = (contact: Contact): number => {
    if (!contact.organizations || contact.organizations.length === 0) return 0;
    
    let total = 0;
    const contactDate = new Date(contact.date_sent);
    
    contact.organizations.forEach(org => {
      // Check if this org is a sales consultant for this lead type
      const isSalesConsultantForLeadType = org.is_sales_consultant && 
        org.sales_consultant_lead_type === contact.interest;
      
      // Skip if we're selling on this ourselves
      if (isSalesConsultantForLeadType) return;
      
      // Check if there's an approved credit for this org on this contact
      const hasApprovedCredit = contact.credit_requests?.some(
        cr => cr.organization_id === org.id && cr.status === 'approved'
      );
      
      // Skip if credited
      if (hasApprovedCredit) return;
      
      // Get price for this lead
      const price = getPriceAtDate(org.id, contact.interest, contactDate);
      total += price;
    });
    
    return total;
  };

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    setDetailsOpen(true);
  };

  // Multi-select handlers
  const handleSelectAll = () => {
    if (selectedDeals.size === filteredContacts.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleSelectDeal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDeals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Get visible columns in order
  const orderedVisibleColumns = columnOrder.filter(col => visibleColumns.has(col.key));

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
          <div className="flex flex-col gap-4">
            {/* Month selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Månad:</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="min-w-32 text-center font-medium">
                  {format(selectedMonth, 'MMMM yyyy', { locale: sv })}
                </span>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Sök på namn, e-post, telefon eller adress..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Select value={filterOrg} onValueChange={setFilterOrg}>
                  <SelectTrigger className="w-48 h-11">
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
                  <SelectTrigger className="w-40 h-11">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla status</SelectItem>
                    <SelectItem value="pending">Väntande</SelectItem>
                    <SelectItem value="approved">Godkänd</SelectItem>
                    <SelectItem value="denied">Nekad</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterInterest} onValueChange={setFilterInterest}>
                  <SelectTrigger className="w-40 h-11">
                    <SelectValue placeholder="Intresse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla intresse</SelectItem>
                    <SelectItem value="sun">Sol</SelectItem>
                    <SelectItem value="battery">Batteri</SelectItem>
                    <SelectItem value="sun_battery">Sol + Batteri</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterRegion} onValueChange={setFilterRegion}>
                  <SelectTrigger className="w-44 h-11">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla regioner</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredContacts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Inga deals hittades"
              description={searchTerm || filterOrg !== 'all' || filterStatus !== 'all' || filterInterest !== 'all' || filterRegion !== 'all'
                ? "Prova att justera dina filter för att hitta det du söker"
                : "Det finns inga deals att visa ännu"}
            />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      {/* Select all checkbox */}
                      <ResizableTableHead className="w-12" minWidth={48}>
                        <Checkbox
                          checked={selectedDeals.size === filteredContacts.length && filteredContacts.length > 0}
                          onCheckedChange={handleSelectAll}
                          aria-label="Markera alla"
                        />
                      </ResizableTableHead>
                      {orderedVisibleColumns.map((col) => (
                        <ResizableTableHead key={col.key} className="font-semibold whitespace-nowrap">
                          {col.label}
                        </ResizableTableHead>
                      ))}
                      {/* Always show settings cog */}
                      <ResizableTableHead className="w-12 sticky right-0 bg-muted/30" minWidth={48}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-56">
                            <div className="space-y-1">
                              <p className="text-sm font-medium mb-3">Visa & ordna kolumner</p>
                              <p className="text-xs text-muted-foreground mb-3">Dra för att ändra ordning</p>
                              {columnOrder.map((col, index) => (
                                <div
                                  key={col.key}
                                  draggable
                                  onDragStart={() => handleDragStart(index)}
                                  onDragOver={(e) => handleDragOver(e, index)}
                                  onDragEnd={handleDragEnd}
                                  className={`flex items-center gap-2 p-2 rounded-md cursor-grab hover:bg-muted/50 ${
                                    draggedIndex === index ? 'opacity-50 bg-muted' : ''
                                  }`}
                                >
                                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                                  <Checkbox
                                    id={`col-${col.key}`}
                                    checked={visibleColumns.has(col.key)}
                                    onCheckedChange={() => toggleColumn(col.key)}
                                  />
                                  <label htmlFor={`col-${col.key}`} className="text-sm cursor-pointer flex-1">
                                    {col.label}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </ResizableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact) => {
                      const creditStatus = getLatestCreditStatus(contact);
                      const isSelected = selectedDeals.has(contact.id);
                      return (
                        <TableRow 
                          key={contact.id} 
                          className={`cursor-pointer transition-colors hover:bg-muted/50 group ${isSelected ? 'bg-primary/5' : ''}`}
                          onClick={() => handleContactClick(contact)}
                        >
                          {/* Row checkbox */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => {
                                setSelectedDeals(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(contact.id)) {
                                    newSet.delete(contact.id);
                                  } else {
                                    newSet.add(contact.id);
                                  }
                                  return newSet;
                                });
                              }}
                              aria-label={`Markera ${contact.email}`}
                            />
                          </TableCell>
                          {orderedVisibleColumns.map((col) => (
                            <TableCell key={col.key} className="whitespace-nowrap">
                              {col.key === 'name' && (
                                <span className="font-medium">{contact.name || '–'}</span>
                              )}
                              {col.key === 'email' && (
                                <span className="font-medium group-hover:text-primary transition-colors">
                                  {contact.email}
                                </span>
                              )}
                              {col.key === 'phone' && (
                                <span className="text-muted-foreground">{contact.phone || '–'}</span>
                              )}
                              {col.key === 'address' && (
                                <span className="text-muted-foreground">{contact.address || '–'}</span>
                              )}
                              {col.key === 'postalCode' && (
                                <span className="text-muted-foreground">{contact.postal_code || '–'}</span>
                              )}
                              {col.key === 'interest' && (
                                <InterestBadge interest={contact.interest} />
                              )}
                              {col.key === 'date' && (
                                <span className="text-muted-foreground">
                                  {format(new Date(contact.date_sent), 'dd MMM yyyy', { locale: sv })}
                                </span>
                              )}
                              {col.key === 'opener' && (
                                <span className="text-muted-foreground">
                                  {contact.opener?.full_name || contact.opener?.email || '–'}
                                </span>
                              )}
                              {col.key === 'bolag1' && (
                                <span className="text-muted-foreground">
                                  {contact.organizations?.[0]?.name || '–'}
                                </span>
                              )}
                              {col.key === 'bolag2' && (
                                <span className="text-muted-foreground">
                                  {contact.organizations?.[1]?.name || '–'}
                                </span>
                              )}
                              {col.key === 'bolag3' && (
                                <span className="text-muted-foreground">
                                  {contact.organizations?.[2]?.name || '–'}
                                </span>
                              )}
                              {col.key === 'bolag4' && (
                                <span className="text-muted-foreground">
                                  {contact.organizations?.[3]?.name || '–'}
                                </span>
                              )}
                              {col.key === 'region' && (
                                <span className="text-muted-foreground">{contact.region?.name || '–'}</span>
                              )}
                              {col.key === 'totalRevenue' && (
                                <span className="font-medium text-primary">
                                  {getContactTotalRevenue(contact).toLocaleString('sv-SE')} kr
                                </span>
                              )}
                              {col.key === 'creditStatus' && (
                                creditStatus ? (
                                  <StatusBadge status={creditStatus} />
                                ) : (
                                  <span className="text-muted-foreground text-sm">–</span>
                                )
                              )}
                            </TableCell>
                          ))}
                          {/* Empty cell for settings column alignment */}
                          <TableCell className="sticky right-0" />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={orderedVisibleColumns.length + 2}>
                        <div className="flex flex-col gap-2 py-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">Summering</span>
                            <span className="text-muted-foreground">
                              {summaryData.totalLeads} leads × {summaryData.totalOrgLinks} partners
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm">
                            {summaryData.orgValues.map((org) => (
                              <div key={org.name} className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-background border">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground font-medium">{org.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground">{org.leadCount} leads</span>
                                  {org.creditedLeads > 0 && (
                                    <span className="text-xs text-amber-600">
                                      ({org.creditedLeads} krediterade: -{org.creditedValue.toLocaleString('sv-SE')} kr)
                                    </span>
                                  )}
                                </div>
                                <span className="text-primary font-bold">
                                  {org.value.toLocaleString('sv-SE')} kr
                                </span>
                              </div>
                            ))}
                          </div>
                          {summaryData.creditedValue > 0 && (
                            <div className="flex items-center justify-end gap-2 text-sm text-amber-600">
                              <span>Totalt krediterat:</span>
                              <span className="font-semibold">-{summaryData.creditedValue.toLocaleString('sv-SE')} kr</span>
                            </div>
                          )}
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                            <span className="text-base">Totalt fakturaunderlag:</span>
                            <span className="text-lg font-bold text-primary">
                              {summaryData.totalValue.toLocaleString('sv-SE')} kr
                            </span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Requests Section - Admin Only */}
      {profile?.role === 'admin' && (
        <Card className="glass-card">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Kreditförfrågningar</CardTitle>
            </div>
            <CardDescription>Granska och hantera inkomna kreditförfrågningar</CardDescription>
          </CardHeader>
          <CardContent>
            {creditRequests.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Inga kreditbegäranden"
                description="Det finns inga kreditförfrågningar att hantera just nu"
              />
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <ResizableTableHead className="font-semibold">Kontakt</ResizableTableHead>
                      <ResizableTableHead className="font-semibold">Organisation</ResizableTableHead>
                      <ResizableTableHead className="font-semibold">Anledning</ResizableTableHead>
                      <ResizableTableHead className="font-semibold">Datum</ResizableTableHead>
                      <ResizableTableHead className="font-semibold">Status</ResizableTableHead>
                      <ResizableTableHead className="w-28 font-semibold">Åtgärder</ResizableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.contact?.email || '–'}</TableCell>
                        <TableCell className="text-muted-foreground">{request.organization?.name || '–'}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">{request.reason || '–'}</TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(request.created_at), 'dd MMM yyyy', { locale: sv })}</TableCell>
                        <TableCell><StatusBadge status={request.status} /></TableCell>
                        <TableCell>
                          {request.status === 'pending' && (
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-success hover:bg-success/10" onClick={() => handleCreditAction(request.id, 'approved')}><Check className="w-4 h-4" /></Button>
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleCreditAction(request.id, 'denied')}><X className="w-4 h-4" /></Button>
                            </div>
                          )}
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

      {/* Selection info bar - rendered via portal to ensure proper fixed positioning */}
      {selectedDeals.size > 0 && ReactDOM.createPortal(
        <div className="fixed bottom-6 left-0 right-0 z-[9999] flex justify-center pointer-events-none" style={{ marginLeft: '16rem' }}>
          <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-primary text-primary-foreground shadow-lg pointer-events-auto animate-in slide-in-from-bottom-4 duration-300">
            <span className="font-medium">{selectedDeals.size} deals markerade</span>
            {(profile?.role === 'admin' || profile?.role === 'teamleader') && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAssignDialogOpen(true)}
                className="gap-2"
              >
                <UserCheck className="w-4 h-4" />
                Tilldela closer
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDeals(new Set())}
              className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
            >
              Avmarkera alla
            </Button>
          </div>
        </div>,
        document.body
      )}

      <AssignToCloserDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        selectedContactIds={[...selectedDeals]}
        contactsData={contacts.map(c => ({
          id: c.id,
          region_id: c.region_id,
          organizations: c.organizations || [],
        }))}
        onAssigned={() => {
          fetchData();
          setSelectedDeals(new Set());
        }}
      />

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