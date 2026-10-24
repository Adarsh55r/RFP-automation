/**
 * Marketing content that must come from real material: a side-by-side
 * comparison on a real public RFP, sample outputs from public RFPs, and
 * permissioned testimonials. Each section stays hidden while its list is
 * empty; nothing here may be invented. See FOUNDER_TODO.md.
 */

export type Comparison = {
  /** The public RFP both tools were given, with a link to its source. */
  rfpTitle: string;
  rfpSourceUrl: string;
  rows: { measure: string; chatgpt: string; draftbid: string }[];
  /** Where the full outputs can be read. */
  outputsUrl: string;
};

export type SampleOutput = { segment: string; title: string; rfpSourceUrl: string; outputUrl: string };

export type Testimonial = { quote: string; name: string; role: string; company: string; permissionOnFile: true };

export const COMPARISON: Comparison | null = null;
export const SAMPLE_OUTPUTS: SampleOutput[] = [];
export const TESTIMONIALS: Testimonial[] = [];
