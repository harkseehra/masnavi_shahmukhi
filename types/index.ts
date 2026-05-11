export type CoupletStatus = 'untranslated' | 'draft' | 'approved';

export type Couplet = {
  id: string;
  daftar: 4;
  couplet_number: number;
  farsi: string;
  punjabi_draft: string;
  punjabi_final: string;
  edit_count: number;
  status: CoupletStatus;
  approved_at: string | null;
  batch_id: string | null;
};
