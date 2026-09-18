/** BRANDSource V1 domain types — mirrors supabase/schema.sql */

export type Role = 'customer' | 'admin' | 'manager';

export type SubOrderStatus =
  | 'new_order'
  | 'payment_received'
  | 'artwork_required'
  | 'proof_awaiting_approval'
  | 'ready_to_order'
  | 'sent_to_supplier'
  | 'in_production'
  | 'dispatched'
  | 'completed';

export type SupplierChannel = 'api' | 'email_po' | 'manual_portal';

export type ClientType = 'managed' | 'direct';

export type OrderStatus = 'draft' | 'new_order' | 'in_production' | 'completed' | 'invoiced';

export type OrderPaymentMethod = 'card' | 'po';

export interface Client {
  id: string;
  name: string;
  client_type: ClientType;
  account_manager_id: string | null;
  credit_term_days: 7 | 14 | 30 | null;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  unit_price: number | null;
  min_order_qty: number;
  example_image_urls: string[];
  active: boolean;
}

export interface OptionGroup {
  id: string;
  product_id: string;
  key: string;
  label: string;
  selection: 'single' | 'multi';
  required: boolean;
  sort_order: number;
}

export interface OptionChoice {
  id: string;
  option_group_id: string;
  key: string;
  label: string;
  price_delta: number;
  sort_order: number;
}

export interface Supplier {
  id: string;
  name: string;
  channel: SupplierChannel;
  notes: string | null;
}

export interface Order {
  id: string;
  customer_id: string;
  client_id: string | null;
  payment_method: OrderPaymentMethod;
  po_number: string | null;
  created_by_id: string | null;
  status: OrderStatus;
  created_at: string;
}

export interface SubOrder {
  id: string;
  order_id: string;
  supplier_id: string | null;
  status: SubOrderStatus;
  eta_days: number | null;
  tracking: string | null;
}
