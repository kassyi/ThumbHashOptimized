export class EncodeHorizGenerator {
  static generateL(unroll: number, maxLFreq: number): string {
    let unrolledPairStr = '';
    for (let u = 0; u < unroll; u++) {
      unrolledPairStr += /*ts*/`
          const pL${u} = rgba32[srcL + ${u}], pR${u} = rgba32[srcR - ${u}];
          const sL${u} = (pL${u} & 0xff) + ((pL${u} >> 8) & 0xff) + ((pL${u} >> 16) & 0xff);
          const sR${u} = (pR${u} & 0xff) + ((pR${u} >> 8) & 0xff) + ((pR${u} >> 16) & 0xff);
          const eL${u} = sL${u} + sR${u}, oL${u} = sL${u} - sR${u};`;
    }

    let unrolledFreqsStr = '';
    for (let f = 0; f < maxLFreq; f++) {
      let calcTerms = [];
      for (let u = 0; u < unroll; u++) {
        const factor = f % 2 === 0 ? `eL${u}` : `oL${u}`;
        calcTerms.push(`(${factor}) * fxTable[fxIdx + ${u * maxLFreq + f}]`);
      }
      unrolledFreqsStr += /*ts*/`\n          s${f} += ${calcTerms.join(' + ')};`;
    }

    let remainderFreqsStr = '';
    for (let f = 0; f < maxLFreq; f++) {
      const factor = f % 2 === 0 ? 'eL' : 'oL';
      remainderFreqsStr += /*ts*/`\n          s${f} += (${factor}) * fxTable[fxIdx + ${f}];`;
    }
    
    let oddFreqsStr = '';
    for (let f = 0; f < maxLFreq; f++) {
      oddFreqsStr += /*ts*/`\n          s${f} += s * fxTable[fxIdx + ${f}];`;
    }

    let assignStr = '';
    for (let f = 0; f < maxLFreq; f++) {
      const prefix = f ? `${f} * ` : '';
      assignStr += /*ts*/`\n        if (nx_l > ${f}) rowSumsL[${prefix}h + y] = s${f} * ENC_L_NORM;`;
    }

    return /*ts*/`
        const halfWUnrolled = halfW & ~${unroll - 1};
        for (let x = 0; x < halfWUnrolled; x += ${unroll}, srcL += ${unroll}, srcR -= ${unroll}, fxIdx += ${unroll} * MAX_L_FREQ) {${unrolledPairStr}${unrolledFreqsStr}
        }

        for (let x = halfWUnrolled; x < halfW; x++, srcL++, srcR--, fxIdx += MAX_L_FREQ) {
          const pL = rgba32[srcL], pR = rgba32[srcR];
          const sL = (pL & 0xff) + ((pL >> 8) & 0xff) + ((pL >> 16) & 0xff);
          const sR = (pR & 0xff) + ((pR >> 8) & 0xff) + ((pR >> 16) & 0xff);
          const eL = sL + sR, oL = sL - sR;${remainderFreqsStr}
        }

        if (isOdd) {
          const p = rgba32[srcL];
          const s = (p & 0xff) + ((p >> 8) & 0xff) + ((p >> 16) & 0xff);${oddFreqsStr}
        }
${assignStr}
`;
  }

  static generatePQ(unroll: number, maxChromaFreq: number, maxLFreq: number): string {
    let unrolledPairStr = '';
    for (let u = 0; u < unroll; u++) {
      unrolledPairStr += /*ts*/`
          const pL${u} = rgba32[srcL + ${u}], pR${u} = rgba32[srcR - ${u}];
          const RL${u} = pL${u} & 0xff, GL${u} = (pL${u} >> 8) & 0xff, BL${u} = (pL${u} >> 16) & 0xff;
          const RR${u} = pR${u} & 0xff, GR${u} = (pR${u} >> 8) & 0xff, BR${u} = (pR${u} >> 16) & 0xff;
          const PL${u} = RL${u} + GL${u} - (BL${u} << 1), QL${u} = RL${u} - GL${u};
          const PR${u} = RR${u} + GR${u} - (BR${u} << 1), QR${u} = RR${u} - GR${u};
          const eP${u} = PL${u} + PR${u}, oP${u} = PL${u} - PR${u};
          const eQ${u} = QL${u} + QR${u}, oQ${u} = QL${u} - QR${u};`;
    }

    let unrolledFreqsStr = '';
    for (let f = 0; f < maxChromaFreq; f++) {
      let calcTermsP = [];
      let calcTermsQ = [];
      for (let u = 0; u < unroll; u++) {
        calcTermsP.push(`(${f % 2 === 0 ? `eP${u}` : `oP${u}`}) * fxTable[fxIdx + ${u * maxLFreq + f}]`);
        calcTermsQ.push(`(${f % 2 === 0 ? `eQ${u}` : `oQ${u}`}) * fxTable[fxIdx + ${u * maxLFreq + f}]`);
      }
      unrolledFreqsStr += /*ts*/`\n          sp${f} += ${calcTermsP.join(' + ')};\n          sq${f} += ${calcTermsQ.join(' + ')};`;
    }

    let remainderFreqsStr = '';
    for (let f = 0; f < maxChromaFreq; f++) {
      remainderFreqsStr += /*ts*/`\n          sp${f} += (${f % 2 === 0 ? 'eP' : 'oP'}) * fxTable[fxIdx + ${f}];\n          sq${f} += (${f % 2 === 0 ? 'eQ' : 'oQ'}) * fxTable[fxIdx + ${f}];`;
    }
    
    let oddFreqsStr = '';
    for (let f = 0; f < maxChromaFreq; f++) {
      oddFreqsStr += /*ts*/`\n          sp${f} += P * fxTable[fxIdx + ${f}];\n          sq${f} += Q * fxTable[fxIdx + ${f}];`;
    }

    let assignStr = '';
    for (let f = 0; f < maxChromaFreq; f++) {
      const prefix = f ? `${f} * ` : '';
      assignStr += /*ts*/`\n        if (nx_l > ${f}) {\n          rowSumsP[${prefix}h + y] = sp${f} * ENC_P_NORM;\n          rowSumsQ[${prefix}h + y] = sq${f} * ENC_Q_NORM;\n        }`;
    }

    let initVars = [];
    for (let f = 0; f < maxChromaFreq; f++) {
      initVars.push(`sp${f} = 0, sq${f} = 0`);
    }

    return /*ts*/`
      for (let y = 0; y < h; y++) {
        let ${initVars.join(', ')};
        let srcL = y * w, srcR = y * w + w - 1, fxIdx = 0;

        const halfWUnrolled = halfW & ~${unroll - 1};
        for (let x = 0; x < halfWUnrolled; x += ${unroll}, srcL += ${unroll}, srcR -= ${unroll}, fxIdx += ${unroll} * MAX_L_FREQ) {${unrolledPairStr}${unrolledFreqsStr}
        }

        for (let x = halfWUnrolled; x < halfW; x++, srcL++, srcR--, fxIdx += MAX_L_FREQ) {
          const pL = rgba32[srcL], pR = rgba32[srcR];
          const RL = pL & 0xff, GL = (pL >> 8) & 0xff, BL = (pL >> 16) & 0xff;
          const RR = pR & 0xff, GR = (pR >> 8) & 0xff, BR = (pR >> 16) & 0xff;
          const PL = RL + GL - (BL << 1), QL = RL - GL;
          const PR = RR + GR - (BR << 1), QR = RR - GR;
          const eP = PL + PR, oP = PL - PR;
          const eQ = QL + QR, oQ = QL - QR;${remainderFreqsStr}
        }

        if (isOdd) {
          const p = rgba32[srcL];
          const R = p & 0xff, G = (p >> 8) & 0xff, B = (p >> 16) & 0xff;
          const P = R + G - (B << 1), Q = R - G;${oddFreqsStr}
        }
${assignStr}
      }
`;
  }
}
