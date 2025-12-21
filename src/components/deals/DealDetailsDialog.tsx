import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { InterestBadge } from '@/components/ui/interest-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Building2, Mail, Phone, MapPin, User, CreditCard, Pencil, X, Check, Package } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Organization {
  id: string;
  name: string;
}

interface Opener {
  id: string;
  full_name: string | null;
  email: string;
}

interface Product {
  id: string;
  name: string;
  type: string;
  base_price_incl_moms: number;
  material_cost_eur: number;
}

interface CreditRequest {
  status: 'pending' | 'approved' | 'denied';
  organization_id: string;
  organization?: { name: string };
}

interface Sale {
  id: string;
  product_id: string | null;
  custom_product_name: string | null;
  custom_product_price: number | null;
  custom_product_material_cost_eur: number | null;
}

interface Contact {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  date_sent: string;
  interest: 'sun' | 'battery' | 'sun_battery';
  opener_id?: string;
  opener?: { email: string; full_name: string | null };
  organizations?: Organization[];
  credit_requests?: CreditRequest[];
  sales?: Sale[];
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
  const [openers, setOpeners] = useState<Opener[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    interest: '' as 'sun' | 'battery' | 'sun_battery',
    opener_id: '',
    selectedOrganizations: [] as string[],
    // Product selection
    useCustomProduct: false,
    product_id: '',
    custom_product_name: '',
    custom_product_price: '',
    custom_product_material_cost_eur: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      const [openersRes, productsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').in('role', ['opener', 'teamleader']),
        supabase.from('products').select('id, name, type, base_price_incl_moms, material_cost_eur').order('name')
      ]);
      if (openersRes.data) setOpeners(openersRes.data);
      if (productsRes.data) setProducts(productsRes.data);
    };
    fetchData();
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isCloser = profile?.role === ('closer' as string);
  const canEditProduct = isAdmin || isCloser;

  const startEditing = () => {
    if (!contact) return;
    
    // Check if this contact has a sale with product info
    const sale = contact.sales?.[0];
    const hasCustomProduct = !!sale?.custom_product_name;
    
    setEditData({
      name: contact.name || '',
      email: contact.email,
      phone: contact.phone || '',
      address: contact.address || '',
      interest: contact.interest,
      opener_id: contact.opener_id || '',
      selectedOrganizations: contact.organizations?.map(o => o.id) || [],
      useCustomProduct: hasCustomProduct,
      product_id: sale?.product_id || '',
      custom_product_name: sale?.custom_product_name || '',
      custom_product_price: sale?.custom_product_price?.toString() || '',
      custom_product_material_cost_eur: sale?.custom_product_material_cost_eur?.toString() || '',
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleOrganizationChange = (orgId: string, checked: boolean) => {
    setEditData(prev => {
      const currentSet = new Set(prev.selectedOrganizations);
      if (checked) {
        currentSet.add(orgId);
      } else {
        currentSet.delete(orgId);
      }
      return {
        ...prev,
        selectedOrganizations: Array.from(currentSet),
      };
    });
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
          opener_id: editData.opener_id,
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

      // Update local contact data immediately for instant UI update
      if (contact) {
        const updatedOrgs = organizations.filter(org => 
          editData.selectedOrganizations.includes(org.id)
        );
        contact.organizations = updatedOrgs;
        contact.name = editData.name || null;
        contact.email = editData.email;
        contact.phone = editData.phone || null;
        contact.address = editData.address || null;
        contact.interest = editData.interest;
      }

      // Update product info if user has permission and there's a sale
      if (canEditProduct && contact.sales?.[0]) {
        const saleUpdate: Record<string, unknown> = {
          product_id: editData.useCustomProduct ? null : (editData.product_id || null),
          custom_product_name: editData.useCustomProduct ? editData.custom_product_name || null : null,
          custom_product_price: editData.useCustomProduct && editData.custom_product_price ? parseFloat(editData.custom_product_price) : null,
          custom_product_material_cost_eur: editData.useCustomProduct && editData.custom_product_material_cost_eur ? parseFloat(editData.custom_product_material_cost_eur) : null,
        };

        await supabase
          .from('sales')
          .update(saleUpdate)
          .eq('id', contact.sales[0].id);
      }

      toast({ title: 'Deal uppdaterad' });
      setIsEditing(false);
      onDealUpdated?.();
    } catch (error: unknown) {
      toast({ title: 'Fel', description: (error as Error).message, variant: 'destructive' });
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Deal Detaljer</DialogTitle>
            {(isAdmin || isCloser) && !isEditing && (
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
                  <div className="space-y-2">
                    <Label>Opener</Label>
                    <Select
                      value={editData.opener_id}
                      onValueChange={(value) => setEditData(prev => ({ ...prev, opener_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj opener" />
                      </SelectTrigger>
                      <SelectContent>
                        {openers.map((opener) => (
                          <SelectItem key={opener.id} value={opener.id}>
                            {opener.full_name || opener.email}
                          </SelectItem>
                        ))}
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
                  {organizations.map((org) => (
                    <div key={org.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`org-${org.id}`}
                        checked={editData.selectedOrganizations.includes(org.id)}
                        onCheckedChange={(checked) => handleOrganizationChange(org.id, checked === true)}
                      />
                      <label htmlFor={`org-${org.id}`} className="text-sm cursor-pointer">
                        {org.name}
                      </label>
                    </div>
                  ))}
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

          {/* Product Selection - Only when editing and for closers/admins */}
          {isEditing && canEditProduct && (
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Produktval
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Anpassad produkt</Label>
                    <p className="text-xs text-muted-foreground">Aktivera för att ange en lead-specifik produkt</p>
                  </div>
                  <Switch
                    checked={editData.useCustomProduct}
                    onCheckedChange={(checked) => setEditData(prev => ({ ...prev, useCustomProduct: checked }))}
                  />
                </div>

                {editData.useCustomProduct ? (
                  <div className="space-y-3 pl-4 border-l-2 border-primary/30">
                    <div className="space-y-2">
                      <Label htmlFor="custom_name">Produktnamn</Label>
                      <Input
                        id="custom_name"
                        value={editData.custom_product_name}
                        onChange={(e) => setEditData(prev => ({ ...prev, custom_product_name: e.target.value }))}
                        placeholder="t.ex. Custom Emaldo 15kWh"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="custom_price">Pris inkl. moms (SEK)</Label>
                        <Input
                          id="custom_price"
                          type="number"
                          value={editData.custom_product_price}
                          onChange={(e) => setEditData(prev => ({ ...prev, custom_product_price: e.target.value }))}
                          placeholder="78000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custom_material">Materialkostnad (EUR)</Label>
                        <Input
                          id="custom_material"
                          type="number"
                          value={editData.custom_product_material_cost_eur}
                          onChange={(e) => setEditData(prev => ({ ...prev, custom_product_material_cost_eur: e.target.value }))}
                          placeholder="6150"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Välj produkt</Label>
                    <Select
                      value={editData.product_id}
                      onValueChange={(value) => setEditData(prev => ({ ...prev, product_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj en produkt" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.base_price_incl_moms.toLocaleString('sv-SE')} kr)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Show current product info when not editing */}
          {!isEditing && contact.sales?.[0] && (
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Vald produkt
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contact.sales[0].custom_product_name ? (
                  <div className="space-y-2">
                    <p className="font-medium">{contact.sales[0].custom_product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Anpassad produkt • {contact.sales[0].custom_product_price?.toLocaleString('sv-SE')} kr
                    </p>
                  </div>
                ) : contact.sales[0].product_id ? (
                  <p className="font-medium">
                    {products.find(p => p.id === contact.sales![0].product_id)?.name || 'Okänd produkt'}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">Ingen produkt vald</p>
                )}
              </CardContent>
            </Card>
          )}

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
