// Source adapter contract. Each external data provider (Tamashii Web,
// Fandom wikis, eBay, etc.) implements this interface; the runner stays
// generic and just iterates over the enabled list.

export type ProposalFieldsValue = string | number | string[];

export type ProposalFields = Partial<{
  description: string;
  release_year: number;
  tags: string[];
  price: number;
  currency: "ARS" | "USD";
  sku: string;
}>;

export type CandidateImage = {
  url: string;
  alt?: string;
};

// Per-field free-text notes the adapter wants surfaced in the admin UI
// (e.g. "min $80 · median $120 · max $180 from 12 sold listings" for the
// eBay price proposal). Keyed by field name; stored on the proposal row.
export type FieldNotes = Partial<Record<keyof ProposalFields, string>>;

export type AdapterResult = {
  source: string;
  sourceUrl: string;
  fields: ProposalFields;
  notes?: FieldNotes;
  images: CandidateImage[];
  confidence: number;
};

export type AdapterInput = {
  name: string;
  lineSlug: string;
  lineName: string;
  seriesName: string | null;
};

export interface SourceAdapter {
  name: string;
  enabled(): boolean;
  fetch(input: AdapterInput): Promise<AdapterResult | null>;
}
