/* Shared domain types. Raw* = shape of dealership_data.json. Everything else is derived by buildModel(). */

export type StageKey = 'new' | 'contacted' | 'test_drive' | 'negotiation' | 'order_placed' | 'delivered';
export type LeadStatus = StageKey | 'lost';
export type SourceKey = 'website' | 'walk_in' | 'referral' | 'social_media' | 'phone_enquiry' | 'auto_expo';
export type RepRole = 'branch_manager' | 'sales_officer';

export interface RawBranch {
  id: string;
  name: string;
  city: string;
}

export interface RawRep {
  id: string;
  name: string;
  branch_id: string;
  role: RepRole;
  joined: string;
}

export interface RawStatusHistoryEntry {
  status: string;
  timestamp: string;
  note: string | null;
}

export interface RawLead {
  id: string;
  customer_name: string;
  phone: string;
  source: SourceKey;
  model_interested: string;
  status: LeadStatus;
  assigned_to: string;
  branch_id: string;
  created_at: string;
  last_activity_at: string;
  status_history: RawStatusHistoryEntry[];
  expected_close_date: string | null;
  deal_value: number;
  lost_reason: string | null;
}

export interface RawDelivery {
  lead_id: string;
  order_date: string;
  delivery_date: string;
  days_to_deliver: number;
  delay_reason: string | null;
}

export interface RawTarget {
  branch_id: string;
  month: string;
  target_units: number;
  target_revenue: number;
}

export interface RawMetadata {
  generated_at: string;
  description: string;
  date_range: string;
  notes: string;
}

export interface RawData {
  branches: RawBranch[];
  sales_reps: RawRep[];
  leads: RawLead[];
  deliveries: RawDelivery[];
  targets: RawTarget[];
  metadata: RawMetadata;
}

export interface HistoryEntry {
  status: string;
  at: Date;
  note: string;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  managerName: string | null;
  repIds: string[];
}

export interface Rep {
  id: string;
  name: string;
  branchId: string;
  role: RepRole;
  roleLabel: string;
  joined: string;
  branchName: string;
}

export interface Delivery {
  leadId: string;
  orderDate: string;
  deliveryDate: string;
  daysToDeliver: number;
  delayReason: string | null;
  delayed: boolean;
  lead?: Lead;
  branchId?: string;
  repId?: string;
  revenue: number;
}

export interface Lead {
  id: string;
  customerName: string;
  phone: string;
  source: SourceKey;
  sourceLabel: string;
  model: string;
  status: LeadStatus;
  repId: string;
  repName: string;
  branchId: string;
  branchName: string;
  createdAt: Date;
  lastActivityAt: Date;
  history: HistoryEntry[];
  stageAt: Partial<Record<StageKey, Date>>;
  reached: (stage: string) => boolean;
  dealValue: number;
  lostReason: string | null;
  lostFrom: StageKey | null;
  open: boolean;
  expectedCloseDate: Date | null;
  overdue: boolean;
  overdueDays: number;
  idleDays: number;
  ageDays: number;
  delivery: Delivery | null;
}

export interface Target {
  branchId: string;
  month: string;
  targetUnits: number;
  targetRevenue: number;
}

export interface Model {
  asOf: Date;
  asOfLabel: string;
  meta: RawMetadata;
  branches: Branch[];
  branchById: Record<string, Branch>;
  reps: Rep[];
  repById: Record<string, Rep>;
  leads: Lead[];
  leadById: Record<string, Lead>;
  deliveries: Delivery[];
  targets: Target[];
  months: string[];
  maturityDays: number;
  dataStart: Date;
  dataEnd: Date;
}

export interface Filters {
  range?: string;
  custom?: { from?: string; to?: string };
  branchId?: string;
  repId?: string;
}

export interface Route {
  screen: string;
  branchId?: string;
  repId?: string;
  tier?: string;
  anchor?: string;
  scope?: string;
}

export interface Cta {
  label: string;
  route: Route;
}

export interface EvidenceItem {
  label: string;
  value: string;
  note?: string;
  baseline?: string;
  bad?: boolean;
}
