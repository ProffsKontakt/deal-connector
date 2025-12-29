import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserCheck, AlertCircle } from 'lucide-react';

interface Closer {
  id: string;
  full_name: string | null;
  email: string;
  regions: { regionId: string; regionName: string; organizationId: string; organizationName: string }[];
}

interface Region {
  id: string;
  name: string;
}

interface AssignToCloserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContactIds: string[];
  contactsData: { id: string; region_id: string | null; organizations: { id: string; name: string }[] }[];
  onAssigned: () => void;
}

export const AssignToCloserDialog = ({
  open,
  onOpenChange,
  selectedContactIds,
  contactsData,
  onAssigned,
}: AssignToCloserDialogProps) => {
  const [closers, setClosers] = useState<Closer[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedCloserId, setSelectedCloserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Get selected contacts' data
  const selectedContacts = contactsData.filter(c => selectedContactIds.includes(c.id));
  
  // Get unique organization IDs from selected contacts
  const selectedOrgIds = [...new Set(selectedContacts.flatMap(c => c.organizations.map(o => o.id)))];

  useEffect(() => {
    if (open) {
      fetchClosersAndRegions();
    }
  }, [open]);

  const fetchClosersAndRegions = async () => {
    setFetching(true);
    try {
      // Fetch all closers with their regions
      const { data: closerProfiles, error: closerError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'closer');

      if (closerError) throw closerError;

      // Fetch closer_regions for all closers
      const { data: closerRegionsData, error: regionsError } = await supabase
        .from('closer_regions')
        .select(`
          closer_id,
          region_id,
          organization_id,
          region:regions(id, name),
          organization:organizations(id, name)
        `);

      if (regionsError) throw regionsError;

      // Fetch all regions for reference
      const { data: allRegions } = await supabase
        .from('regions')
        .select('id, name');
      
      setRegions(allRegions || []);

      // Build closers with their region info
      const closersWithRegions: Closer[] = (closerProfiles || []).map(closer => {
        const closerRegs = (closerRegionsData || [])
          .filter((cr: any) => cr.closer_id === closer.id)
          .map((cr: any) => ({
            regionId: cr.region_id,
            regionName: cr.region?.name || 'Okänd region',
            organizationId: cr.organization_id,
            organizationName: cr.organization?.name || 'Okänd organisation',
          }));

        return {
          ...closer,
          regions: closerRegs,
        };
      });

      setClosers(closersWithRegions);
    } catch (error) {
      console.error('Error fetching closers:', error);
      toast.error('Kunde inte hämta closers');
    } finally {
      setFetching(false);
    }
  };

  // Filter closers to show those assigned to the selected contacts' organizations
  const relevantClosers = closers.filter(closer => {
    // Check if closer has regions for any of the selected organizations
    return closer.regions.some(r => selectedOrgIds.includes(r.organizationId));
  });

  const otherClosers = closers.filter(closer => {
    return !closer.regions.some(r => selectedOrgIds.includes(r.organizationId));
  });

  const handleAssign = async () => {
    if (!selectedCloserId) {
      toast.error('Välj en closer');
      return;
    }

    setLoading(true);
    try {
      // Get the selected closer's organization assignments
      const selectedCloser = closers.find(c => c.id === selectedCloserId);
      const closerOrgIds = selectedCloser?.regions.map(r => r.organizationId) || [];
      
      // For each selected contact, create a sales record ONLY for organizations the closer is assigned to
      const salesRecords = selectedContacts.flatMap(contact => {
        // Filter to only organizations the closer is assigned to
        const relevantOrgs = contact.organizations.filter(org => closerOrgIds.includes(org.id));
        
        return relevantOrgs.map(org => ({
          contact_id: contact.id,
          closer_id: selectedCloserId,
          organization_id: org.id,
          pipeline_status: 'new',
        }));
      });

      if (salesRecords.length === 0) {
        toast.info('Closern är inte tilldelad till någon av de valda organisationerna');
        onOpenChange(false);
        return;
      }

      // Check for existing sales to avoid duplicates
      const { data: existingSales } = await supabase
        .from('sales')
        .select('contact_id, organization_id')
        .in('contact_id', selectedContactIds);

      const existingKeys = new Set(
        (existingSales || []).map(s => `${s.contact_id}-${s.organization_id}`)
      );

      // Filter out already existing sales
      const newSalesRecords = salesRecords.filter(
        s => !existingKeys.has(`${s.contact_id}-${s.organization_id}`)
      );

      if (newSalesRecords.length === 0) {
        toast.info('Alla valda leads är redan tilldelade');
        onOpenChange(false);
        return;
      }

      const { error } = await supabase
        .from('sales')
        .insert(newSalesRecords);

      if (error) throw error;

      toast.success(
        `${newSalesRecords.length} leads tilldelade till ${selectedCloser?.full_name || selectedCloser?.email}`
      );
      
      onAssigned();
      onOpenChange(false);
      setSelectedCloserId('');
    } catch (error: any) {
      console.error('Error assigning leads:', error);
      toast.error('Kunde inte tilldela leads: ' + (error.message || 'Okänt fel'));
    } finally {
      setLoading(false);
    }
  };

  const getCloserDisplayName = (closer: Closer) => {
    return closer.full_name || closer.email;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Tilldela leads till closer
          </DialogTitle>
          <DialogDescription>
            Välj en closer att tilldela {selectedContactIds.length} valda leads till.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected leads summary */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium mb-2">Valda leads: {selectedContactIds.length}</p>
            <div className="flex flex-wrap gap-1">
              {selectedOrgIds.map(orgId => {
                const org = selectedContacts.find(c => c.organizations.some(o => o.id === orgId))
                  ?.organizations.find(o => o.id === orgId);
                return org ? (
                  <Badge key={orgId} variant="outline" className="text-xs">
                    {org.name}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>

          {fetching ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Välj closer</Label>
                <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj en closer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {relevantClosers.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          Rekommenderade (arbetar med valda organisationer)
                        </div>
                        {relevantClosers.map(closer => (
                          <SelectItem key={closer.id} value={closer.id}>
                            <div className="flex flex-col">
                              <span>{getCloserDisplayName(closer)}</span>
                              <span className="text-xs text-muted-foreground">
                                {closer.regions
                                  .filter(r => selectedOrgIds.includes(r.organizationId))
                                  .map(r => r.organizationName)
                                  .filter((v, i, a) => a.indexOf(v) === i)
                                  .join(', ')}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {otherClosers.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">
                          Övriga closers
                        </div>
                        {otherClosers.map(closer => (
                          <SelectItem key={closer.id} value={closer.id}>
                            <span>{getCloserDisplayName(closer)}</span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {closers.length === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        Inga closers hittades
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedCloserId && (() => {
                const selectedCloser = closers.find(c => c.id === selectedCloserId);
                const closerOrgIds = selectedCloser?.regions.map(r => r.organizationId) || [];
                const relevantOrgsCount = selectedOrgIds.filter(id => closerOrgIds.includes(id)).length;
                const actualAssignments = selectedContacts.reduce((sum, contact) => {
                  return sum + contact.organizations.filter(org => closerOrgIds.includes(org.id)).length;
                }, 0);
                
                return (
                  <div className="p-3 rounded-lg border bg-primary/5">
                    <p className="text-sm font-medium text-primary">
                      Vald closer: {getCloserDisplayName(selectedCloser!)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedContacts.length} leads × {relevantOrgsCount} matchande organisationer = {actualAssignments} tilldelningar
                    </p>
                    {relevantOrgsCount < selectedOrgIds.length && (
                      <p className="text-xs text-amber-600 mt-1">
                        OBS: Closern är endast tilldelad till {relevantOrgsCount} av {selectedOrgIds.length} organisationer
                      </p>
                    )}
                  </div>
                );
              })()}

              {relevantClosers.length === 0 && closers.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    Inga closers är kopplade till de valda organisationerna. 
                    Du kan fortfarande välja en closer från listan.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Avbryt
          </Button>
          <Button onClick={handleAssign} disabled={!selectedCloserId || loading || fetching}>
            {loading ? 'Tilldelar...' : 'Tilldela leads'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
