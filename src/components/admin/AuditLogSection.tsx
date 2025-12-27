import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ResizableTableHead } from '@/components/ui/resizable-table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { History, Search, ChevronDown, ChevronRight, Filter } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_values: any;
  new_values: any;
  changed_by: string | null;
  changed_at: string;
  changed_by_email?: string;
}

const TABLE_LABELS: Record<string, string> = {
  organizations: 'Partners',
  organization_timeline_events: 'Tidslinjehändelser',
  organization_status_history: 'Statushistorik',
  products: 'Produkter',
  profiles: 'Användare',
  sales: 'Affärer',
  contacts: 'Kontakter',
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  INSERT: { label: 'Skapad', color: 'bg-emerald-500/10 text-emerald-600' },
  UPDATE: { label: 'Uppdaterad', color: 'bg-blue-500/10 text-blue-600' },
  DELETE: { label: 'Borttagen', color: 'bg-red-500/10 text-red-600' },
};

export function AuditLogSection() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Filters
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [tableFilter, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(100);

      if (tableFilter !== 'all') {
        query = query.eq('table_name', tableFilter);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data } = await query;

      if (data) {
        // Fetch user emails for changed_by
        const userIds = [...new Set(data.map(d => d.changed_by).filter(Boolean))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds);

        const emailMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

        setLogs(data.map(log => ({
          ...log,
          changed_by_email: log.changed_by ? emailMap.get(log.changed_by) || 'Okänd' : 'System',
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getChangedFields = (oldValues: Record<string, any> | null, newValues: Record<string, any> | null) => {
    if (!oldValues && newValues) {
      return Object.keys(newValues).filter(k => !['id', 'created_at', 'updated_at'].includes(k));
    }
    if (!newValues) return [];
    
    const changed: string[] = [];
    for (const key of Object.keys(newValues)) {
      if (['id', 'created_at', 'updated_at'].includes(key)) continue;
      if (JSON.stringify(oldValues?.[key]) !== JSON.stringify(newValues[key])) {
        changed.push(key);
      }
    }
    return changed;
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '–';
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nej';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      log.table_name.toLowerCase().includes(searchLower) ||
      log.changed_by_email?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.new_values).toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Ändringslogg
            </CardTitle>
            <CardDescription>Spårning av alla ändringar i systemet</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Sök i ändringar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-44">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Alla tabeller" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla tabeller</SelectItem>
              {Object.entries(TABLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Alla åtgärder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla åtgärder</SelectItem>
              <SelectItem value="INSERT">Skapad</SelectItem>
              <SelectItem value="UPDATE">Uppdaterad</SelectItem>
              <SelectItem value="DELETE">Borttagen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredLogs.length === 0 ? (
          <EmptyState
            icon={History}
            title="Inga ändringar"
            description="Det finns inga registrerade ändringar att visa"
          />
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <ResizableTableHead className="w-10" />
                  <ResizableTableHead>Tidpunkt</ResizableTableHead>
                  <ResizableTableHead>Användare</ResizableTableHead>
                  <ResizableTableHead>Tabell</ResizableTableHead>
                  <ResizableTableHead>Åtgärd</ResizableTableHead>
                  <ResizableTableHead>Ändringar</ResizableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const isExpanded = expandedRows.has(log.id);
                  const changedFields = getChangedFields(log.old_values, log.new_values);
                  const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: '' };
                  
                  return (
                    <>
                      <TableRow 
                        key={log.id} 
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => toggleRow(log.id)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(log.changed_at), 'd MMM yyyy HH:mm', { locale: sv })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.changed_by_email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {TABLE_LABELS[log.table_name] || log.table_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={actionInfo.color}>
                            {actionInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {changedFields.length > 0 ? (
                            <span>{changedFields.slice(0, 3).join(', ')}{changedFields.length > 3 ? ` +${changedFields.length - 3}` : ''}</span>
                          ) : (
                            <span>–</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${log.id}-details`} className="bg-muted/20">
                          <TableCell colSpan={6} className="p-4">
                            <div className="space-y-3">
                              <p className="text-xs text-muted-foreground">
                                Record ID: <code className="bg-muted px-1 py-0.5 rounded">{log.record_id}</code>
                              </p>
                              {changedFields.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">Ändrade fält:</p>
                                  <div className="grid gap-2">
                                    {changedFields.map(field => (
                                      <div key={field} className="flex items-start gap-2 text-sm">
                                        <span className="font-medium min-w-[120px]">{field}:</span>
                                        {log.action === 'UPDATE' && log.old_values && (
                                          <>
                                            <span className="text-muted-foreground line-through">
                                              {formatValue(log.old_values[field])}
                                            </span>
                                            <span className="text-muted-foreground">→</span>
                                          </>
                                        )}
                                        <span className="text-foreground">
                                          {formatValue(log.new_values?.[field])}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
