import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { InterestBadge } from '@/components/ui/interest-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Building2, Mail, Phone, MapPin, User, CreditCard, Pencil, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Organization {
  id: string;
  name: string;
}

interface CreditRequest {
  status: 'pending' | 'approved' | 'denied';
  organization_id: string;
  organization?: { name: string };
}

interface Contact {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  date_sent: string;
  interest: 'sun' | 'battery' | 'sun_battery';
  opener?: { email: string; full_name: string | null };
  organizations?: Organization[];
  credit_requests?: CreditRequest[];
}

interface DealDetailsDialogProps {
  contact: Contact | null;
  organizations: Organization[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDealUpdated?: () => void;
}

export const DealDetailsDialog = ({ contact, organizations, open, onOpenChange, onDealUpdated }: DealDetailsDialogProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    interest: '' as 'sun' | 'battery' | 'sun_battery',
    selectedOrganizations: [] as string[],
  });

  const isAdmin = profile?.role === 'admin';

  const startEditing = () => {
    if (!contact) return;
    setEditData({
      name: contact.name || '',
      email: contact.email,
      phone: contact.phone || '',
      address: contact.address || '',
      interest: contact.interest,
      selectedOrganizations: contact.organizations?.map(o => o.id) || [],
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const toggleOrganization = (orgId: string) => {
    setEditData(prev => ({
      ...prev,
      selectedOrganizations: prev.selectedOrganizations.includes(orgId)
        ? prev.selectedOrganizations.filter(id => id !== orgId)
        : [...prev.selectedOrganizations, orgId],
    }));
  };

  const handleSave = async () => {
    if (!contact) return;
    setLoading(true);

    try {
      // Update contact
      const { error: contactError } = await supabase
        .from('contacts')
        .update({
          name: editData.name || null,
          email: editData.email,
          phone: editData.phone || null,
          address: editData.address || null,
          interest: editData.interest,
        })
        .eq('id', contact.id);

      if (contactError) throw contactError;

      // Update organization links
      // First, delete existing links
      await supabase
        .from('contact_organizations')
        .delete()
        .eq('contact_id', contact.id);

      // Then, insert new links
      if (editData.selectedOrganizations.length > 0) {
        const orgLinks = editData.selectedOrganizations.map(orgId => ({
          contact_id: contact.id,
          organization_id: orgId,
        }));

        const { error: linkError } = await supabase
          .from('contact_organizations')
          .insert(orgLinks);

        if (linkError) throw linkError;
      }

      toast({ title: 'Deal uppdaterad' });
      setIsEditing(false);
      onDealUpdated?.();
    } catch (error: any) {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!contact) return null;

  // Get organization names for credit requests
  const getCreditingOrganizations = () => {
    if (!contact.credit_requests || contact.credit_requests.length === 0) return [];
    
    return contact.credit_requests.map(cr => {
      const org = organizations.find(o => o.id === cr.organization_id);
      return {
        name: org?.name || 'Okänd organisation',
        status: cr.status,
      };
    });
  };

  const creditingOrgs = getCreditingOrganizations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Deal Detaljer</DialogTitle>
            {isAdmin && !isEditing && (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="w-4 h-4 mr-2" />
                Redigera
              </Button>
            )}
            {isEditing && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={cancelEditing} disabled={loading}>
                  <X className="w-4 h-4 mr-2" />
                  Avbryt
                </Button>
                <Button size="sm" onClick={handleSave} disabled={loading}>
                  <Check className="w-4 h-4 mr-2" />
                  Spara
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Contact Info */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Kontaktinformation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Namn</Label>
                    <Input
                      id="name"
                      value={editData.name}
                      onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-post</Label>
                    <Input
                      id="email"
                      value={editData.email}
                      onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      value={editData.phone}
                      onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Adress</Label>
                    <Input
                      id="address"
                      value={editData.address}
                      onChange={(e) => setEditData(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Intresse</Label>
                    <Select
                      value={editData.interest}
                      onValueChange={(value: 'sun' | 'battery' | 'sun_battery') => 
                        setEditData(prev => ({ ...prev, interest: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sun">Sol</SelectItem>
                        <SelectItem value="battery">Batteri</SelectItem>
                        <SelectItem value="sun_battery">Sol + Batteri</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-primary" />
                    <span className="font-medium">{contact.name || 'Ej angivet'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{contact.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{contact.phone || 'Ej angivet'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{contact.address || 'Ej angivet'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Opener:</span>
                    <span className="px-3 py-1 rounded-[15px] bg-primary/10 text-primary text-sm font-medium">
                      {contact.opener?.full_name || contact.opener?.email || 'Okänd'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-sm text-muted-foreground">Intresse:</span>
                    <InterestBadge interest={contact.interest} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Skickad: {format(new Date(contact.date_sent), 'dd MMMM yyyy', { locale: sv })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Organizations */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Tilldelade bolag
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-2">
                  {organizations.map((org) => {
                    const isChecked = editData.selectedOrganizations.includes(org.id);
                    return (
                      <div key={org.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`org-${org.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            setEditData(prev => ({
                              ...prev,
                              selectedOrganizations: checked
                                ? [...prev.selectedOrganizations, org.id]
                                : prev.selectedOrganizations.filter(id => id !== org.id),
                            }));
                          }}
                        />
                        <label htmlFor={`org-${org.id}`} className="text-sm cursor-pointer">
                          {org.name}
                        </label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                contact.organizations && contact.organizations.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {contact.organizations.map((org) => (
                      <span
                        key={org.id}
                        className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
                      >
                        {org.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Inga bolag tilldelade</p>
                )
              )}
            </CardContent>
          </Card>

          {/* Credit Requests - Read only */}
          {!isEditing && (
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Kreditförfrågningar
                </CardTitle>
              </CardHeader>
              <CardContent>
                {creditingOrgs.length > 0 ? (
                  <div className="space-y-2">
                    {creditingOrgs.map((credit, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <span className="font-medium">{credit.name}</span>
                        <StatusBadge status={credit.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Ingen har begärt kredit</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
