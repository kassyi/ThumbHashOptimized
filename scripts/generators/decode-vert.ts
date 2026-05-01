export class DecodeVertGenerator {
    static generateIDCTVert(maxLFreq: number, maxChromaFreq: number): string {
        let out = "";
        for (let _ly = 3; _ly <= maxLFreq; _ly++) {
            let branch =
                _ly === 3
                    ? "if (ly === 3)"
                    : "else " + (_ly === maxLFreq ? "" : `if (ly === ${_ly})`);
            out += /*ts*/ `
    ${branch} {
      for (let y = 0; y < halfH; y++) {`;

            let fVars = [];
            for (let i = 0; i < _ly; i++)
                fVars.push(`const f${i} = dFy[${i ? i + " * " : ""}h + y];`);

            out += /*ts*/ `
        ${fVars.join("\n        ")}
        let it = y * w * RGBA_CHANNELS, ib = (h - 1 - y) * w * RGBA_CHANNELS;
        for (let x = 0; x < w; x++, it += RGBA_CHANNELS, ib += RGBA_CHANNELS) {`;

            const channels = [
                { id: "l", base: "LB", src: "tL", freq: _ly },
                { id: "p", base: "PB", src: "tP", freq: maxChromaFreq },
                { id: "q", base: "QB", src: "tQ", freq: maxChromaFreq },
            ];

            const chDefs = channels
                .map((c) => {
                    let e = c.base + " + " + c.src + "[x] * f0";
                    for (let i = 2; i < c.freq; i += 2)
                        e += " + " + c.src + "[w" + i + " + x] * f" + i;
                    let o = c.src + "[w1 + x] * f1";
                    for (let i = 3; i < c.freq; i += 2)
                        o += " + " + c.src + "[w" + i + " + x] * f" + i;
                    return `${c.id}E = ${e},\n            ${c.id}O = ${o}`;
                })
                .join(",\n            ");

            out += /*ts*/ `
          const ${chDefs};
          const lT = lE + lO, pT = pE + pO, qT = qE + qO;
          const lB = lE - lO, pB = pE - pO, qB = qE - qO;
          rgba[it] = lT + pT + qT;
          rgba[it + 1] = lT + pT - qT;
          rgba[it + 2] = lT - (pT + pT);
          rgba[it + 3] = AB;
          rgba[ib] = lB + pB + qB;
          rgba[ib + 1] = lB + pB - qB;
          rgba[ib + 2] = lB - (pB + pB);
          rgba[ib + 3] = AB;
        }
      }
    }`;
        }
        return out;
    }

    static generateIDCTVertOdd(
        maxLFreq: number,
        maxChromaFreq: number,
    ): string {
        let out = "";
        for (let _ly = 3; _ly <= maxLFreq; _ly++) {
            let branch =
                _ly === 3
                    ? "if (ly === 3)"
                    : "else " + (_ly === maxLFreq ? "" : `if (ly === ${_ly})`);
            let fVars = [`f0 = dFy[y]`];
            for (let i = 2; i < _ly; i += 2)
                fVars.push(`f${i} = dFy[${i} * h + y]`);

            out += /*ts*/ `
      ${branch} {
        const ${fVars.join(", ")};
        for (let x = 0, it = y * w * RGBA_CHANNELS; x < w; x++, it += RGBA_CHANNELS) {`;

            const channels = [
                { id: "l", base: "LB", src: "tL", freq: _ly },
                { id: "p", base: "PB", src: "tP", freq: maxChromaFreq },
                { id: "q", base: "QB", src: "tQ", freq: maxChromaFreq },
            ];

            const chDefs = channels
                .map((c) => {
                    let e = c.base + " + " + c.src + "[x] * f0";
                    for (let i = 2; i < c.freq; i += 2)
                        e += " + " + c.src + "[w" + i + " + x] * f" + i;
                    return `${c.id} = ${e}`;
                })
                .join(",\n            ");

            out += /*ts*/ `
          const ${chDefs};
          rgba[it] = l + p + q;
          rgba[it + 1] = l + p - q;
          rgba[it + 2] = l - (p + p);
          rgba[it + 3] = AB;
        }
      }`;
        }
        return out;
    }
}
