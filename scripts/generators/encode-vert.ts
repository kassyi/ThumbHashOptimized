export class EncodeVertGenerator {
    static generatePQ(maxChromaFreq: number): string {
        let out = "";
        for (let cy = 0; cy < maxChromaFreq; cy++) {
            for (let cx = 0; cx < maxChromaFreq - cy; cx++) {
                let block = /*ts*/ `
    {
      let fp = 0, fq = 0;
      for (let y = 0; y < h; y++) {
        const fy = fyTable[${cy} * h + y];
        fp += rowSumsP[${cx} * h + y] * fy;
        fq += rowSumsQ[${cx} * h + y] * fy;
      }
      fp /= numPixels;
      fq /= numPixels;`;

                if (cx === 0 && cy === 0) {
                    block += /*ts*/ `
      p_dc = fp;
      q_dc = fq;
    }`;
                } else {
                    block += /*ts*/ `
      p_ac.push(fp);
      q_ac.push(fq);
      if (fp > p_scale) p_scale = fp;
      else if (-fp > p_scale) p_scale = -fp;
      if (fq > q_scale) q_scale = fq;
      else if (-fq > q_scale) q_scale = -fq;
    }`;
                }
                out += block;
            }
        }
        return out;
    }
}
