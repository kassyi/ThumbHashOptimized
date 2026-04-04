export class DecodeHorizGenerator {
  static generateL(maxLFreq: number): string {
    let out = '';
    for (let _ly = 3; _ly <= maxLFreq; _ly++) {
      let branch = _ly === 3 ? "if (ly === 3)" : "else " + (_ly === maxLFreq ? "" : `if (ly === ${_ly})`);
      out += /*ts*/`
    ${branch} {
      let j = 0;`;
      
      for (let cy = 0; cy < _ly; cy++) {
        out += /*ts*/`
      {
        const to = ${cy} * w;
        let first = true;
        for (let cx = ${cy ? 0 : 1}; cx * ${_ly} < lx * ${_ly - cy}; cx++, j++) {
          const ac = dLAc[j], fo = cx * w;
          if (first) {
            for (let x = 0; x < w; x++) tL[to + x] = ac * dFx[fo + x];
            first = false;
          } else {
            for (let x = 0; x < w; x++) tL[to + x] += ac * dFx[fo + x];
          }
        }
      }`;
      }
      out += /*ts*/`
    }`;
    }
    return out;
  }

  static generatePQ(maxChromaFreq: number): string {
    let out = '';
    let j = 0;
    for (let cy = 0; cy < maxChromaFreq; cy++) {
      const toExpr = cy === 0 ? "0" : "w" + cy;
      let first = true;
      for (let cx = cy ? 0 : 1; cx < maxChromaFreq - cy; cx++, j++) {
        out += /*ts*/`
    // cy = ${cy}, cx = ${cx}
    {
      const fo = ${cx} * w, ap = dPAc[${j}], aq = dQAc[${j}];`;
        if (first) {
          out += /*ts*/`
      for (let x = 0; x < w; x++) {
        const f = dFx[fo + x];
        tP[${toExpr} + x] = ap * f;
        tQ[${toExpr} + x] = aq * f;
      }`;
          first = false;
        } else {
          out += /*ts*/`
      for (let x = 0; x < w; x++) {
        const f = dFx[fo + x];
        tP[${toExpr} + x] += ap * f;
        tQ[${toExpr} + x] += aq * f;
      }`;
        }
        out += /*ts*/`
    }`;
      }
    }
    return out;
  }
}
