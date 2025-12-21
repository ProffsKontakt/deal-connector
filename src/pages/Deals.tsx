import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { InterestBadge } from '@/components/ui/interest-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CreateDealDialog } from '@/components/deals/CreateDealDialog';
import { DealDetailsDialog } from '@/components/deals/DealDetailsDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, FileText, TrendingUp, Calendar, ChevronLeft, ChevronRight, Settings, GripVertical } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { sv } from 'date-fns/locale';

type ColumnKey = 'email' | 'phone' | 'interest' | 'date' | 'opener' | 'creditStatus';

interface ColumnConfig {
  key: ColumnKey;
  label: string;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'email', label: 'E-post' },
  { key: 'phone', label: 'Telefon' },
  { key: 'interest', label: 'Intresse' },
  { key: 'date', label: 'Datum' },
  { key: 'opener', label: 'Opener' },
  { key: 'creditStatus', label: 'Kredit Status' },
];

interface Contact {
  id: string;
  email: string;
  name: string | null;
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
  price_per_solar_deal: number | null;
  price_per_battery_deal: number | null;
}

interface PriceHistory {
  organization_id: string;
  price_per_solar_deal: number | null;
  price_per_battery_deal: number | null;
  effective_from: string;
  effective_until: string | null;
}

const Deals = () => {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // Column management with ordering
  const [columnOrder, setColumnOrder] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(['email', 'phone', 'interest', 'date', 'opener', 'creditStatus']));
  
  // Multi-select state
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  
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
        .select('id, name, price_per_solar_deal, price_per_battery_deal');
      setOrganizations(orgsData || []);

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
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.address?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOrg = filterOrg === 'all' || 
      contact.organizations?.some(o => o.id === filterOrg);

    const matchesStatus = filterStatus === 'all' ||
      contact.credit_requests?.some(cr => cr.status === filterStatus);

    // Month filter
    const contactDate = new Date(contact.date_sent);
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const matchesMonth = contactDate >= monthStart && contactDate <= monthEnd;

    return matchesSearch && matchesOrg && matchesStatus && matchesMonth;
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
            
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Sök på namn, e-post, telefon eller adress..."
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      {/* Select all checkbox */}
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedDeals.size === filteredContacts.length && filteredContacts.length > 0}
                          onCheckedChange={handleSelectAll}
                          aria-label="Markera alla"
                        />
                      </TableHead>
                      {orderedVisibleColumns.map((col) => (
                        <TableHead key={col.key} className="font-semibold whitespace-nowrap">
                          {col.label}
                        </TableHead>
                      ))}
                      {/* Always show settings cog */}
                      <TableHead className="w-12 sticky right-0 bg-muted/30">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-56" onInteractOutside={(e) => e.preventDefault()}>
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
                      </TableHead>
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
                              {col.key === 'email' && (
                                <span className="font-medium group-hover:text-primary transition-colors">
                                  {contact.email}
                                </span>
                              )}
                              {col.key === 'phone' && (
                                <span className="text-muted-foreground">{contact.phone || '–'}</span>
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

      {/* Selection info bar */}
      {selectedDeals.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-primary text-primary-foreground shadow-lg">
            <span className="font-medium">{selectedDeals.size} deals markerade</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedDeals(new Set())}
            >
              Avmarkera alla
            </Button>
          </div>
        </div>
      )}

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