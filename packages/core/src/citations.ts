export interface CitationReference {
  label: string;
  type: "pdf" | "image" | "external";
  url: string;
  description: string;
  page?: number | null;
}

const PHAK_CHAPTER_PAGES: Record<number, number> = {
  1: 16,
  2: 40,
  3: 72,
  4: 88,
  5: 98,
  6: 149,
  7: 161,
  8: 203,
  9: 231,
  10: 245,
  11: 257,
  12: 285,
  13: 311,
  14: 335,
  15: 376,
  16: 388,
  17: 423,
};

const FIGURE_IMAGES: Record<string, string> = {
  "2": "",
  "12": "",
  "15": "",
  "17": "",
  "20": "/figures/figure-20.png",
  "21": "/figures/figure-21.png",
  "22": "/figures/figure-22.png",
  "23": "/figures/figure-23.png",
  "26": "/figures/figure-26.png",
  "59": "/figures/figure-59.png",
};

export function parseCitation(citation: string): CitationReference[] {
  const refs: CitationReference[] = [];
  const parts = citation.split(";").map((s) => s.trim());

  for (const part of parts) {
    const phakMatch = part.match(/FAA-H-8083-25[A-Z]?,\s*Ch(?:apter)?\s*(\d+)/i);
    if (phakMatch) {
      const ch = parseInt(phakMatch[1], 10);
      refs.push({
        label: `PHAK Ch ${ch}`,
        type: "pdf",
        url: `/pdfs/faa-h-8083-25c.pdf`,
        page: PHAK_CHAPTER_PAGES[ch] ?? 1,
        description: `Pilot's Handbook of Aeronautical Knowledge — Chapter ${ch}`,
      });
      continue;
    }

    const acsMatch = part.match(/ACS\s+(UA\.\w+\.\w+\.?\w*)/i);
    if (acsMatch) {
      refs.push({
        label: `ACS ${acsMatch[1]}`,
        type: "pdf",
        url: `/pdfs/uas-acs.pdf`,
        page: null,
        description: `UAS Airman Certification Standards — ${acsMatch[1]}`,
      });
      continue;
    }

    const figMatch = part.match(/FAA-CT-8080-2H,?\s*Figure\s*(\d+)/i);
    if (figMatch) {
      const figNum = figMatch[1];
      const imageUrl = FIGURE_IMAGES[figNum];
      if (imageUrl) {
        refs.push({
          label: `Figure ${figNum}`,
          type: "image",
          url: imageUrl,
          description: `AKTS Supplement — Figure ${figNum}`,
        });
      }
    }

    const cfrMatch = part.match(/14\s*CFR\s*§\s*(\d+)\.(\d+)/);
    if (cfrMatch) {
      const partNum = cfrMatch[1];
      const section = cfrMatch[2];
      refs.push({
        label: `14 CFR §${partNum}.${section}`,
        type: "external",
        url: `https://www.ecfr.gov/current/title-14/part-${partNum}/section-${partNum}.${section}`,
        description: `Electronic Code of Federal Regulations — Title 14, Part ${partNum}, §${partNum}.${section}`,
      });

      const extraCfr = [...part.matchAll(/§\s*(\d+)\.(\d+)/g)];
      if (extraCfr.length > 1) {
        for (let i = 1; i < extraCfr.length; i++) {
          const p2 = extraCfr[i][1];
          const s2 = extraCfr[i][2];
          refs.push({
            label: `14 CFR §${p2}.${s2}`,
            type: "external",
            url: `https://www.ecfr.gov/current/title-14/part-${p2}/section-${p2}.${s2}`,
            description: `Electronic Code of Federal Regulations — Title 14, Part ${p2}, §${p2}.${s2}`,
          });
        }
      }
      continue;
    }

    const cfrRangeMatch = part.match(/14\s*CFR\s*§\s*(\d+)\.(\d+)-(\d+)/);
    if (cfrRangeMatch) {
      const partNum = cfrRangeMatch[1];
      const sectionStart = cfrRangeMatch[2];
      refs.push({
        label: `14 CFR §${partNum}.${sectionStart}`,
        type: "external",
        url: `https://www.ecfr.gov/current/title-14/part-${partNum}/section-${partNum}.${sectionStart}`,
        description: `Electronic Code of Federal Regulations — Title 14, Part ${partNum}`,
      });
      continue;
    }

    const aimMatch = part.match(/AIM\s+(\d+-\d+-\d+)/i);
    if (aimMatch) {
      const aimSection = aimMatch[1];
      const [chapter] = aimSection.split("-");
      refs.push({
        label: `AIM ${aimSection}`,
        type: "external",
        url: `https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap${chapter}.html`,
        description: `Aeronautical Information Manual — Section ${aimSection}`,
      });
      continue;
    }

    if (/AC\s*107-2/i.test(part)) {
      refs.push({
        label: "AC 107-2A",
        type: "pdf",
        url: `/pdfs/ac-107-2a.pdf`,
        description: "Advisory Circular 107-2A — Small Unmanned Aircraft Systems",
      });
      continue;
    }
  }

  return refs;
}
