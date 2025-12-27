import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Trash2, Building2, Settings2, DollarSign, Percent, Calculator, Package, MapPin } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface CostSegment {
  id?: string;
  name: string;
  amount: number;
  is_eur: boolean;
}

interface Product {
  id: string;
  name: string;
  type: string;
  base_price_incl_moms: number;
  material_cost_eur: number;
  green_tech_deduction_percent: number;
  capacity_kwh: number | null;
}

interface ProductProvision {
  product_id: string;
  provision_amount: number;
}

interface Partner {
  id: string;
  name: string;
  contact_person_name: string | null;
  contact_phone: string | null;
  price_per_solar_deal: number | null;
  price_per_battery_deal: number | null;
  price_per_site_visit: number | null;
  is_sales_consultant?: boolean;
  billing_model?: string;
  company_markup_share?: number;
  base_cost_for_billing?: number;
  eur_to_sek_rate?: number;
  lf_finans_percent?: number;
  default_customer_price?: number;
  allow_manual_calculation?: boolean;
  sales_consultant_lead_type?: string | null;
}

interface EditPartnerDialogProps {
  partner: Partner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export const EditPartnerDialog = ({ partner, open, onOpenChange, onUpdated }: EditPartnerDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productProvisions, setProductProvisions] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState({
    name: '',
    contact_person_name: '',
    contact_phone: '',
    price_per_solar_deal: '',
    price_per_battery_deal: '',
    price_per_site_visit: '',
    is_sales_consultant: false,
    billing_model: 'fixed',
    company_markup_share: '70',
    base_cost_for_billing: '23000',
    eur_to_sek_rate: '11',
    lf_finans_percent: '3',
    default_customer_price: '78000',
    allow_manual_calculation: false,
    sales_consultant_lead_type: '' as string,
    // For "Allt över" calculation preview
    preview_total_price: '78000',
    preview_property_owners: '1',
    preview_product_id: '',
  });
  const [costSegments, setCostSegments] = useState<CostSegment[]>([]);
  const [newCostSegment, setNewCostSegment] = useState<CostSegment>({
    name: '',
    amount: 0,
    is_eur: false,
  });
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
    fetchRegions();
  }, []);

  useEffect(() => {
    if (partner && open) {
      setFormData({
        name: partner.name || '',
        contact_person_name: partner.contact_person_name || '',
        contact_phone: partner.contact_phone || '',
        price_per_solar_deal: partner.price_per_solar_deal?.toString() || '',
        price_per_battery_deal: partner.price_per_battery_deal?.toString() || '',
        price_per_site_visit: partner.price_per_site_visit?.toString() || '',
        is_sales_consultant: partner.is_sales_consultant || false,
        billing_model: partner.billing_model || 'fixed',
        company_markup_share: (partner.company_markup_share ?? 70).toString(),
        base_cost_for_billing: (partner.base_cost_for_billing ?? 23000).toString(),
        eur_to_sek_rate: (partner.eur_to_sek_rate ?? 11).toString(),
        lf_finans_percent: (partner.lf_finans_percent ?? 3).toString(),
        default_customer_price: (partner.default_customer_price ?? 78000).toString(),
        allow_manual_calculation: partner.allow_manual_calculation || false,
        sales_consultant_lead_type: partner.sales_consultant_lead_type || '',
        preview_total_price: (partner.default_customer_price ?? 78000).toString(),
        preview_property_owners: '1',
        preview_product_id: '',
      });
      fetchCostSegments();
      fetchProductProvisions();
      fetchOrganizationRegions();
    }
  }, [partner, open]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('name');
    
    if (data) {
      setProducts(data);
      if (data.length > 0 && !formData.preview_product_id) {
        setFormData(prev => ({ ...prev, preview_product_id: data[0].id }));
      }
    }
  };

  const fetchRegions = async () => {
    const { data } = await supabase
      .from('regions')
      .select('id, name')
      .order('name');
    if (data) setRegions(data);
  };

  const fetchOrganizationRegions = async () => {
    if (!partner) return;
    const { data } = await supabase
      .from('organization_regions')
      .select('region_id')
      .eq('organization_id', partner.id);
    if (data) {
      setSelectedRegions(data.map(r => r.region_id));
    }
  };

  const handleRegionToggle = (regionId: string) => {
    setSelectedRegions(prev => 
      prev.includes(regionId) 
        ? prev.filter(id => id !== regionId)
        : [...prev, regionId]
    );
  };

  const fetchCostSegments = async () => {
    if (!partner) return;
    
    const { data } = await supabase
      .from('organization_cost_segments')
      .select('*')
      .eq('organization_id', partner.id)
      .order('created_at');
    
    if (data) {
      setCostSegments(data.map(cs => ({
        id: cs.id,
        name: cs.name,
        amount: cs.amount,
        is_eur: cs.is_eur,
      })));
    }
  };

  const fetchProductProvisions = async () => {
    if (!partner) return;
    
    const { data } = await supabase
      .from('organization_product_provisions')
      .select('product_id, provision_amount')
      .eq('organization_id', partner.id);
    
    if (data) {
      const provisions: Record<string, number> = {};
      data.forEach(p => {
        provisions[p.product_id] = p.provision_amount;
      });
      setProductProvisions(provisions);
    }
  };

  const updateProductProvision = async (productId: string, amount: number) => {
    if (!partner) return;
    
    // Update local state immediately for responsive UI
    setProductProvisions(prev => ({ ...prev, [productId]: amount }));
    
    // Upsert to database
    const { error } = await supabase
      .from('organization_product_provisions')
      .upsert({
        organization_id: partner.id,
        product_id: productId,
        provision_amount: amount,
      }, {
        onConflict: 'organization_id,product_id',
      });

    if (error) {
      toast.error('Kunde inte uppdatera provision');
    }
  };

  const addCostSegment = async () => {
    if (!partner || !newCostSegment.name.trim()) {
      toast.error('Ange ett namn för kostnadssegmentet');
      return;
    }

    const { data, error } = await supabase
      .from('organization_cost_segments')
      .insert({
        organization_id: partner.id,
        name: newCostSegment.name.trim(),
        amount: newCostSegment.amount,
        is_eur: newCostSegment.is_eur,
      })
      .select()
      .single();

    if (error) {
      toast.error('Kunde inte lägga till kostnadssegment');
      return;
    }

    setCostSegments(prev => [...prev, { 
      id: data.id, 
      name: data.name, 
      amount: data.amount, 
      is_eur: data.is_eur 
    }]);
    setNewCostSegment({ name: '', amount: 0, is_eur: false });
    toast.success('Kostnadssegment tillagt');
  };

  const removeCostSegment = async (id: string) => {
    const { error } = await supabase
      .from('organization_cost_segments')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Kunde inte ta bort kostnadssegment');
      return;
    }

    setCostSegments(prev => prev.filter(cs => cs.id !== id));
    toast.success('Kostnadssegment borttaget');
  };

  // Calculate the "Allt över" billing breakdown
  const billingBreakdown = useMemo(() => {
    const totalPriceInclMoms = parseFloat(formData.preview_total_price) || 0;
    const propertyOwners = parseInt(formData.preview_property_owners) || 1;
    const eurRate = parseFloat(formData.eur_to_sek_rate) || 11;
    const lfFinansPercent = parseFloat(formData.lf_finans_percent) || 3;
    const baseCost = parseFloat(formData.base_cost_for_billing) || 23000;
    const companyShare = parseFloat(formData.company_markup_share) || 70;
    const billingModel = formData.billing_model;
    
    const selectedProduct = products.find(p => p.id === formData.preview_product_id);
    const greenTechPercent = selectedProduct?.green_tech_deduction_percent || 48.5;
    const materialCostEur = selectedProduct?.material_cost_eur || 0;
    
    // Calculate green tech deduction for CUSTOMER BENEFIT ONLY
    // This does NOT affect our billing - we bill full price regardless of property owners
    // Max deduction per property owner: 50,000 SEK
    // OR max greenTechPercent% of total price (whichever is lower)
    const maxDeductionPerOwner = 50000;
    const totalMaxDeductionByOwners = propertyOwners * maxDeductionPerOwner;
    const maxDeductionByPercent = totalPriceInclMoms * (greenTechPercent / 100);
    const greenTechDeduction = Math.min(totalMaxDeductionByOwners, maxDeductionByPercent);
    
    // Price after green tech deduction (what customer actually pays)
    const priceAfterDeduction = totalPriceInclMoms - greenTechDeduction;
    
    // Material cost in SEK (only for Emaldo products with EUR cost)
    const materialCostSek = materialCostEur > 0 ? materialCostEur * eurRate : 0;
    
    // LF Finans fee (percentage of total price)
    const lfFinansFee = totalPriceInclMoms * (lfFinansPercent / 100);
    
    // Custom cost segments in SEK
    const customCostsSek = costSegments.reduce((sum, segment) => {
      return sum + (segment.is_eur ? segment.amount * eurRate : segment.amount);
    }, 0);
    
    // Total costs
    const totalCosts = baseCost + materialCostSek + lfFinansFee + customCostsSek;
    
    // BILLING IS BASED ON FULL PRICE (not after deduction)
    // The green tech deduction only benefits the customer, not our billing
    // Property owners do NOT affect what we bill - only what customer pays out of pocket
    const priceExMoms = totalPriceInclMoms / 1.25;
    
    // Billable amount = price ex moms - costs
    // NO extra from property owners - that deduction is a state subsidy for the customer
    const billableAmount = priceExMoms - totalCosts;
    
    // For "Allt över" model: ALL påslag goes to ProffsKontakt (no split with installer)
    // For "Satt provision" model: påslag is split between ProffsKontakt and installer
    const companyBillable = billingModel === 'above_cost' 
      ? billableAmount  // ProffsKontakt gets all of it
      : billableAmount * (companyShare / 100);  // Split only for fixed model
    const partnerBillable = billingModel === 'above_cost'
      ? 0  // Installer gets nothing from påslag in "Allt över"
      : billableAmount * ((100 - companyShare) / 100);
    
    return {
      totalPriceInclMoms,
      greenTechDeduction,
      greenTechPercent,
      maxDeductionByOwners: totalMaxDeductionByOwners,
      maxDeductionByPercent,
      deductionLimitedBy: totalMaxDeductionByOwners < maxDeductionByPercent ? 'owners' : 'percent',
      priceAfterDeduction,
      priceExMoms,
      baseCost,
      materialCostSek,
      materialCostEur,
      lfFinansFee,
      customCostsSek,
      totalCosts,
      billableAmount,
      companyShare,
      companyBillable,
      partnerBillable,
      billingModel,
    };
  }, [formData, products, costSegments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: formData.name.trim(),
          contact_person_name: formData.contact_person_name.trim() || null,
          contact_phone: formData.contact_phone.trim() || null,
          price_per_solar_deal: formData.price_per_solar_deal ? parseFloat(formData.price_per_solar_deal) : null,
          price_per_battery_deal: formData.price_per_battery_deal ? parseFloat(formData.price_per_battery_deal) : null,
          price_per_site_visit: formData.price_per_site_visit ? parseFloat(formData.price_per_site_visit) : null,
          is_sales_consultant: formData.is_sales_consultant,
          billing_model: formData.billing_model,
          company_markup_share: parseFloat(formData.company_markup_share) || 70,
          base_cost_for_billing: parseFloat(formData.base_cost_for_billing) || 23000,
          eur_to_sek_rate: parseFloat(formData.eur_to_sek_rate) || 11,
          lf_finans_percent: parseFloat(formData.lf_finans_percent) || 3,
          default_customer_price: parseFloat(formData.default_customer_price) || 78000,
          allow_manual_calculation: formData.allow_manual_calculation,
          sales_consultant_lead_type: formData.sales_consultant_lead_type || null,
        } as any)
        .eq('id', partner.id);

      if (error) throw error;

      // Update organization regions
      await supabase
        .from('organization_regions')
        .delete()
        .eq('organization_id', partner.id);
      
      if (selectedRegions.length > 0) {
        const regionsData = selectedRegions.map(regionId => ({
          organization_id: partner.id,
          region_id: regionId,
        }));
        await supabase.from('organization_regions').insert(regionsData);
      }

      toast.success('Partner uppdaterad');
      onOpenChange(false);
      onUpdated();
    } catch (error: any) {
      toast.error('Kunde inte uppdatera partner: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!partner) return null;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Redigera {partner.name}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
              Grundläggande information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Företagsnamn</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Partner AB"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_person">Kontaktperson</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_person_name: e.target.value }))}
                  placeholder="Anna Andersson"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Telefon</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                placeholder="070-123 45 67"
              />
            </div>
          </div>

          <Separator />

          {/* Geographic Regions */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
              <MapPin className="h-4 w-4" />
              Geografiska regioner
            </h3>
            <p className="text-xs text-muted-foreground">
              Välj vilka regioner denna partner opererar i. Closers kan endast tilldelas regioner som partnern har.
            </p>
            
            {regions.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {regions.map((region) => (
                  <label
                    key={region.id}
                    className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedRegions.includes(region.id)}
                      onCheckedChange={() => handleRegionToggle(region.id)}
                    />
                    <span className="text-sm">{region.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Inga regioner skapade ännu</p>
            )}
          </div>

          <Separator />

          {/* Lead Pricing */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
              <DollarSign className="h-4 w-4" />
              Lead-prissättning
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price_solar">Sol-pris (kr)</Label>
                <Input
                  id="price_solar"
                  type="number"
                  value={formData.price_per_solar_deal}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_per_solar_deal: e.target.value }))}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_battery">Batteri-pris (kr)</Label>
                <Input
                  id="price_battery"
                  type="number"
                  value={formData.price_per_battery_deal}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_per_battery_deal: e.target.value }))}
                  placeholder="300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_visit">Platsbesök-pris (kr)</Label>
                <Input
                  id="price_visit"
                  type="number"
                  value={formData.price_per_site_visit}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_per_site_visit: e.target.value }))}
                  placeholder="200"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Sales Consultant Toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Säljkonsult
                </h3>
                <p className="text-sm text-muted-foreground">
                  Aktivera för att visa säljkonsult-inställningar
                </p>
              </div>
              <Switch
                checked={formData.is_sales_consultant}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_sales_consultant: checked }))}
              />
            </div>

            {formData.is_sales_consultant && (
              <div className="pl-4 border-l-2 border-primary/30 space-y-4 animate-fade-in">
                {/* Sales Consultant Lead Type */}
                <div className="space-y-2">
                  <Label>Vilken leadtyp ska vi själva sälja på?</Label>
                  <Select
                    value={formData.sales_consultant_lead_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, sales_consultant_lead_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj leadtyp (valfritt)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ingen (fakturera alla leads)</SelectItem>
                      <SelectItem value="sun">Sol</SelectItem>
                      <SelectItem value="battery">Batteri</SelectItem>
                      <SelectItem value="sun_battery">Sol + Batteri</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Om valt, exkluderas leads med denna typ från faktureringsunderlaget för denna partner
                  </p>
                </div>

                {/* Billing Model */}
                <div className="space-y-2">
                  <Label>Faktureringsmodell</Label>
                  <Select
                    value={formData.billing_model}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, billing_model: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Satt provision</SelectItem>
                      <SelectItem value="above_cost">Allt över (kostnad subtraheras)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.billing_model === 'above_cost' 
                      ? '"Allt över" subtraherar alla kostnader från ordervärdet och fakturerar resten'
                      : '"Satt provision" använder en fast provision per produkttyp'}
                  </p>
                </div>

                {/* Company Markup Share */}
                <div className="space-y-2">
                  <Label htmlFor="company_share" className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    ProffsKontakts andel av påslag (%)
                  </Label>
                  <Input
                    id="company_share"
                    type="number"
                    value={formData.company_markup_share}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_markup_share: e.target.value }))}
                    placeholder="70"
                  />
                  <p className="text-xs text-muted-foreground">
                    Hur stor del av påslag ex moms som ProffsKontakt tar (t.ex. 70%)
                  </p>
                </div>

                {/* Fixed provision - product-based */}
                {formData.billing_model === 'fixed' && (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4" />
                      Provision per produkttyp
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Ange fast provision för varje produkttyp som säljs via denna partner
                    </p>
                    
                    {products.length > 0 ? (
                      <div className="space-y-3">
                        {products.map((product) => (
                          <div key={product.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                            <div className="flex-1">
                              <p className="font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.type === 'battery' ? 'Batteri' : 'Sol'} • Grundpris: {formatCurrency(product.base_price_incl_moms)} kr
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm text-muted-foreground whitespace-nowrap">Provision (kr)</Label>
                              <Input
                                type="number"
                                className="w-28"
                                value={productProvisions[product.id] ?? ''}
                                onChange={(e) => updateProductProvision(product.id, parseFloat(e.target.value) || 0)}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Inga produkter konfigurerade</p>
                    )}
                  </div>
                )}

                {formData.billing_model === 'above_cost' && (
                  <>
                    {/* Toggle for manual calculation */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div>
                        <Label className="font-medium">Tillåt manuell beräkning</Label>
                        <p className="text-xs text-muted-foreground">
                          Om aktiverat kan closers ange egna beräkningsparametrar i sina lead-kort
                        </p>
                      </div>
                      <Switch
                        checked={formData.allow_manual_calculation}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_manual_calculation: checked }))}
                      />
                    </div>
                    
                    {/* Calculation inputs */}
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium flex items-center gap-2 text-sm">
                        <Calculator className="h-4 w-4" />
                        Beräkningsparametrar (förhandsvisning)
                      </h4>
                      
                      {/* Product selection */}
                      <div className="space-y-2">
                        <Label>Produkt (för materialkostnad)</Label>
                        <Select
                          value={formData.preview_product_id}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, preview_product_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Välj produkt" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} ({product.material_cost_eur > 0 ? `${product.material_cost_eur} EUR` : 'Ingen EUR-kostnad'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          EUR-kostnaden används endast för Emaldo-produkter
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="preview_price">Totalpris mot kund (inkl. moms)</Label>
                          <Input
                            id="preview_price"
                            type="number"
                            value={formData.preview_total_price}
                            onChange={(e) => setFormData(prev => ({ ...prev, preview_total_price: e.target.value }))}
                            placeholder="78000"
                          />
                          <p className="text-xs text-muted-foreground">
                            Pris innan Grön Teknik-avdrag
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="preview_owners">Antal fastighetsägare</Label>
                          <Input
                            id="preview_owners"
                            type="number"
                            min="1"
                            value={formData.preview_property_owners}
                            onChange={(e) => setFormData(prev => ({ ...prev, preview_property_owners: e.target.value }))}
                            placeholder="1"
                          />
                          <p className="text-xs text-muted-foreground">
                            Max 50 000 kr avdrag per ägare
                          </p>
                        </div>
                      </div>

                      {/* Base cost & rates */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="base_cost">Baskostnad (kr)</Label>
                          <Input
                            id="base_cost"
                            type="number"
                            value={formData.base_cost_for_billing}
                            onChange={(e) => setFormData(prev => ({ ...prev, base_cost_for_billing: e.target.value }))}
                            placeholder="23000"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="eur_rate">EUR → SEK</Label>
                          <Input
                            id="eur_rate"
                            type="number"
                            step="0.01"
                            value={formData.eur_to_sek_rate}
                            onChange={(e) => setFormData(prev => ({ ...prev, eur_to_sek_rate: e.target.value }))}
                            placeholder="11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lf_finans">LF Finans (%)</Label>
                          <Input
                            id="lf_finans"
                            type="number"
                            step="0.1"
                            value={formData.lf_finans_percent}
                            onChange={(e) => setFormData(prev => ({ ...prev, lf_finans_percent: e.target.value }))}
                            placeholder="3"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cost Segments */}
                    <div className="space-y-3">
                      <Label>Kostnadssegment</Label>
                      <p className="text-xs text-muted-foreground">
                        Lägg till anpassade kostnader som subtraheras från ordervärdet
                      </p>

                      {costSegments.length > 0 && (
                        <div className="space-y-2">
                          {costSegments.map((segment) => (
                            <div key={segment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div>
                                <p className="font-medium">{segment.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {segment.amount.toLocaleString('sv-SE')} {segment.is_eur ? 'EUR' : 'SEK'}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => segment.id && removeCostSegment(segment.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input
                          placeholder="Namn (t.ex. Materialkostnad)"
                          value={newCostSegment.name}
                          onChange={(e) => setNewCostSegment(prev => ({ ...prev, name: e.target.value }))}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          placeholder="Belopp"
                          className="w-24"
                          value={newCostSegment.amount || ''}
                          onChange={(e) => setNewCostSegment(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        />
                        <Select
                          value={newCostSegment.is_eur ? 'eur' : 'sek'}
                          onValueChange={(value) => setNewCostSegment(prev => ({ ...prev, is_eur: value === 'eur' }))}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sek">SEK</SelectItem>
                            <SelectItem value="eur">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="icon" onClick={addCostSegment}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Cost Breakdown Preview */}
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                      <h4 className="font-medium flex items-center gap-2 text-sm text-primary">
                        <Calculator className="h-4 w-4" />
                        Kostnadssammanställning (förhandsvisning)
                      </h4>
                      
                      <div className="space-y-2 text-sm">
                        {/* BILLING CALCULATION - Based on full price */}
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Fakturering (baserat på fullt pris)</div>
                        
                        <div className="flex justify-between">
                          <span>Grundpris inkl. moms (SEK)</span>
                          <span className="font-medium">{formatCurrency(billingBreakdown.totalPriceInclMoms)} kr</span>
                        </div>
                        
                        <div className="flex justify-between text-muted-foreground">
                          <span>Pris ex. moms (÷ 1.25)</span>
                          <span>{formatCurrency(billingBreakdown.priceExMoms)} kr</span>
                        </div>
                        
                        <Separator className="my-2" />
                        
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Kostnader</div>
                        
                        <div className="flex justify-between text-muted-foreground">
                          <span>Baskostnad (installation)</span>
                          <span>-{formatCurrency(billingBreakdown.baseCost)} kr</span>
                        </div>
                        
                        {billingBreakdown.materialCostSek > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Materialkostnad ({billingBreakdown.materialCostEur} EUR × {formData.eur_to_sek_rate})</span>
                            <span>-{formatCurrency(billingBreakdown.materialCostSek)} kr</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between text-muted-foreground">
                          <span>LF Finans ({formData.lf_finans_percent}%)</span>
                          <span>-{formatCurrency(billingBreakdown.lfFinansFee)} kr</span>
                        </div>
                        
                        {billingBreakdown.customCostsSek > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Övriga kostnader</span>
                            <span>-{formatCurrency(billingBreakdown.customCostsSek)} kr</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between font-medium pt-1 border-t">
                          <span>Totala kostnader</span>
                          <span>-{formatCurrency(billingBreakdown.totalCosts)} kr</span>
                        </div>
                        
                        <Separator className="my-2" />
                        
                        <div className="flex justify-between text-lg font-bold pt-1 border-t">
                          <span>Fakturaunderlag (påslag)</span>
                          <span className={billingBreakdown.billableAmount >= 0 ? 'text-success' : 'text-destructive'}>
                            {formatCurrency(billingBreakdown.billableAmount)} kr
                          </span>
                        </div>
                        
                        <div className="flex justify-between text-primary font-medium">
                          <span>→ ProffsKontakt fakturerar</span>
                          <span>{formatCurrency(billingBreakdown.companyBillable)} kr</span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-dashed">
                          I "Allt över"-modellen går hela påslaget till ProffsKontakt. Closerns andel definieras per closer i Säljare-sektionen.
                        </p>
                        
                        <Separator className="my-2" />
                        
                        {/* CUSTOMER BENEFIT - Green tech deduction info */}
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Kundförmån (Grön Teknik-avdrag)</div>
                        
                        <div className="flex justify-between text-muted-foreground">
                          <span className="flex items-center gap-1">
                            Avdrag för kund
                            <span className="text-xs">
                              ({billingBreakdown.deductionLimitedBy === 'owners' 
                                ? `${formData.preview_property_owners} ägare × 50 000 kr` 
                                : `${billingBreakdown.greenTechPercent}% av totalpris`})
                            </span>
                          </span>
                          <span className="font-medium text-success">-{formatCurrency(billingBreakdown.greenTechDeduction)} kr</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span>Kund betalar (efter avdrag)</span>
                          <span className="font-medium">{formatCurrency(billingBreakdown.priceAfterDeduction)} kr</span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Grön Teknik-avdraget påverkar endast vad kunden betalar, inte fakturaunderlaget
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Sparar...' : 'Spara ändringar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
