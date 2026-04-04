/**
 * ThumbHash Original (Reference) Implementation
 *
 * A faithful port of the original ThumbHash algorithm by Evan Wallace.
 * This implementation prioritises readability and correctness over performance;
 * it serves as the baseline against which the optimised implementation is benchmarked.
 *
 * @see {@link https://github.com/evanw/thumbhash} Original source and specification.
 */
import { IThumbHashStrategy, ThumbHashImage } from "./thumbhash-strategy";
import { Profiler, IProfiler } from "./profiler";

const { PI, round, max, min, cos, abs } = Math;

/**
 * Reference ThumbHash encoder/decoder.
 *
 * Implements {@link IThumbHashStrategy} using the original unoptimised algorithm.
 * The encoder and decoder are intentionally kept simple, matching the upstream
 * JavaScript reference implementation, so that benchmark comparisons are fair.
 */
export class ThumbHashOriginal implements IThumbHashStrategy {
  public readonly encodeProfiler?: IProfiler;
  public readonly decodeProfiler?: IProfiler;

  /**
   * Initialise single-stage profilers for encode and decode.
   *
   * Unlike the optimised implementation, the original algorithm is not split into
   * sub-stages. A single "process" entry covers the entire operation, making it
   * easy to compare total throughput in the benchmark UI.
   */
  constructor() {
    if (__PROFILE__) {
      this.encodeProfiler = new Profiler({
        process: { label: "Legacy Encode Process", color: "bg-gray-500" },
      });
      this.decodeProfiler = new Profiler({
        process: { label: "Legacy Decode Process", color: "bg-gray-400" },
      });
    }
  }

  /**
   * Encode an RGBA image into a ThumbHash using the original reference algorithm.
   *
   * @param w - Width of the source image in pixels.
   * @param h - Height of the source image in pixels.
   * @param rgba - Flat RGBA pixel buffer (Uint8Array or Uint8ClampedArray).
   * @returns Uint8Array containing the ThumbHash bytes.
   *
   * The encoder performs a 2D DCT by decomposing the image into L (luminance),
   * P and Q (chroma) channels, then packs the DC and AC coefficients into a
   * compact byte array. Alpha is supported but increases the hash size slightly.
   */
  rgbaToThumbHash(w: number, h: number, rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
    if (__PROFILE__) this.encodeProfiler!.start();
    let avg_r = 0,
      avg_g = 0,
      avg_b = 0,
      avg_a = 0;
    // Compute alpha-weighted colour averages. Each channel is premultiplied by
    // alpha so that transparent pixels do not skew the dominant colour.
    for (let i = 0, j = 0; i < w * h; i++, j += 4) {
      let alpha = rgba[j + 3] / 255;
      avg_r += (alpha / 255) * rgba[j];
      avg_g += (alpha / 255) * rgba[j + 1];
      avg_b += (alpha / 255) * rgba[j + 2];
      avg_a += alpha;
    }
    if (avg_a) {
      avg_r /= avg_a;
      avg_g /= avg_a;
      avg_b /= avg_a;
    }
    let hasAlpha = avg_a < w * h;
    let l_limit = hasAlpha ? 5 : 7;
    let lx = max(1, round((l_limit * w) / max(w, h))),
      ly = max(1, round((l_limit * h) / max(w, h)));
    let l: number[] = [],
      p: number[] = [],
      q: number[] = [],
      a: number[] = [];
    for (let i = 0, j = 0; i < w * h; i++, j += 4) {
      let alpha = rgba[j + 3] / 255;
      let r = avg_r * (1 - alpha) + (alpha / 255) * rgba[j],
        g = avg_g * (1 - alpha) + (alpha / 255) * rgba[j + 1],
        b = avg_b * (1 - alpha) + (alpha / 255) * rgba[j + 2];
      l[i] = (r + g + b) / 3;
      p[i] = (r + g) / 2 - b;
      q[i] = r - g;
      a[i] = alpha;
    }
    /**
     * Run a 2D DCT over a single image channel and return the DC coefficient,
     * the normalised AC coefficients, and the AC scale factor.
     *
     * The AC coefficients are mapped to [0, 1] relative to `scale` so they can
     * be quantised into 4-bit values during bit-packing. The DC component is
     * kept in its original floating-point form because it contributes to the
     * 6-bit header fields.
     *
     * @param channel - Flat array of per-pixel channel values (premultiplied).
     * @param nx - Number of horizontal frequency components to compute.
     * @param ny - Number of vertical frequency components to compute.
     */
    let encodeChannel = (channel: number[], nx: number, ny: number) => {
      let dc = 0,
        ac: number[] = [],
        scale = 0,
        fx: number[] = [];
      for (let cy = 0; cy < ny; cy++) {
        for (let cx = 0; cx * ny < nx * (ny - cy); cx++) {
          let f = 0;
          // Precompute the horizontal cosine factors for this frequency to avoid
          // recomputing them in the inner pixel loop.
          for (let x = 0; x < w; x++) fx[x] = cos((PI / w) * cx * (x + 0.5));
          for (let y = 0; y < h; y++)
            for (let x = 0, fy = cos((PI / h) * cy * (y + 0.5)); x < w; x++) f += channel[x + y * w] * fx[x] * fy;
          f /= w * h;
          if (cx || cy) {
            ac.push(f);
            scale = max(scale, abs(f));
          } else {
            dc = f;
          }
        }
      }
      // Normalise AC values to [0, 1] range for 4-bit quantisation.
      if (scale) for (let i = 0; i < ac.length; i++) ac[i] = 0.5 + (0.5 / scale) * ac[i];
      return [dc, ac, scale] as [number, number[], number];
    };
    let [l_dc, l_ac, l_scale] = encodeChannel(l, max(3, lx), max(3, ly));
    let [p_dc, p_ac, p_scale] = encodeChannel(p, 3, 3);
    let [q_dc, q_ac, q_scale] = encodeChannel(q, 3, 3);
    let [a_dc, a_ac, a_scale] = hasAlpha ? encodeChannel(a, 5, 5) : [0, [], 0];
    let isLandscape = w > h;
    // Pack the 24-bit header: L-DC (6 bits), P-DC (6 bits), Q-DC (6 bits),
    // L-scale (5 bits), and the alpha flag (1 bit). Bit positions match the
    // ThumbHash specification exactly.
    let header24 =
      round(63 * l_dc) |
      (round(31.5 + 31.5 * p_dc) << 6) |
      (round(31.5 + 31.5 * q_dc) << 12) |
      (round(31 * l_scale) << 18) |
      (hasAlpha ? 1 : 0) << 23;
    // Pack the 16-bit header: minor-axis frequency count (3 bits), P-scale (6 bits),
    // Q-scale (6 bits), and the landscape flag (1 bit).
    let header16 =
      (isLandscape ? ly : lx) | (round(63 * p_scale) << 3) | (round(63 * q_scale) << 9) | ((isLandscape ? 1 : 0) << 15);
    let hash = [header24 & 255, (header24 >> 8) & 255, header24 >> 16, header16 & 255, header16 >> 8];
    let ac_start = hasAlpha ? 6 : 5;
    let ac_index = 0;
    if (hasAlpha) hash.push(round(15 * a_dc) | (round(15 * a_scale) << 4));
    // Pack two 4-bit AC coefficients per byte using alternating nibbles.
    for (let ac of hasAlpha ? [l_ac, p_ac, q_ac, a_ac] : [l_ac, p_ac, q_ac])
      for (let f of ac) hash[ac_start + (ac_index >> 1)] |= round(15 * f) << ((ac_index++ & 1) << 2);
    const result = new Uint8Array(hash);
    if (__PROFILE__) this.encodeProfiler!.record("process");
    return result;
  }

  /**
   * Decode a ThumbHash back to RGBA pixel data using the original reference algorithm.
   *
   * @param hash - ThumbHash byte array produced by {@link rgbaToThumbHash}.
   * @returns An object containing width, height, and a Uint8Array of RGBA pixels.
   *
   * The decoder unpacks the header fields, reconstructs the AC coefficient arrays
   * for each channel, and then synthesises each pixel by evaluating the 2D IDCT
   * sum at that pixel's coordinates. Output size is always 32×32 or an aspect-
   * ratio-preserving variant thereof.
   */
  thumbHashToRGBA(hash: Uint8Array): ThumbHashImage {
    if (__PROFILE__) this.decodeProfiler!.start();
    let header24 = hash[0] | (hash[1] << 8) | (hash[2] << 16);
    let header16 = hash[3] | (hash[4] << 8);
    let l_dc = (header24 & 63) / 63,
      p_dc = ((header24 >> 6) & 63) / 31.5 - 1,
      q_dc = ((header24 >> 12) & 63) / 31.5 - 1,
      l_scale = ((header24 >> 18) & 31) / 31,
      hasAlpha = header24 >> 23;
    let p_scale = ((header16 >> 3) & 63) / 63,
      q_scale = ((header16 >> 9) & 63) / 63,
      isLandscape = header16 >> 15;
    let lx = max(3, isLandscape ? (hasAlpha ? 5 : 7) : header16 & 7),
      ly = max(3, isLandscape ? header16 & 7 : hasAlpha ? 5 : 7);
    let a_dc = hasAlpha ? (hash[5] & 15) / 15 : 1,
      a_scale = (hash[5] >> 4) / 15;
    let ac_start = hasAlpha ? 6 : 5,
      ac_index = 0;
    /**
     * Unpack the 4-bit nibble-encoded AC coefficients for a single channel and
     * rescale them from the stored [0, 1] range back to [-scale, +scale].
     *
     * @param nx - Number of horizontal frequency components.
     * @param ny - Number of vertical frequency components.
     * @param scale - The AC amplitude scale factor extracted from the header.
     */
    let decodeChannel = (nx: number, ny: number, scale: number) => {
      let ac: number[] = [];
      for (let cy = 0; cy < ny; cy++)
        for (let cx = cy ? 0 : 1; cx * ny < nx * (ny - cy); cx++)
          // Each nibble is mapped from [0,15] → [0,1] → [-1,1] → [-scale, scale].
          ac.push((((hash[ac_start + (ac_index >> 1)] >> ((ac_index++ & 1) << 2)) & 15) / 7.5 - 1) * scale);
      return ac;
    };
    let l_ac = decodeChannel(lx, ly, l_scale),
      p_ac = decodeChannel(3, 3, p_scale * 1.25),
      q_ac = decodeChannel(3, 3, q_scale * 1.25),
      a_ac = hasAlpha ? decodeChannel(5, 5, a_scale) : [];
    let ratio = lx / ly,
      w = round(ratio > 1 ? 32 : 32 * ratio),
      h = round(ratio > 1 ? 32 / ratio : 32);
    let rgba = new Uint8Array(w * h * 4),
      fx: number[] = [],
      fy: number[] = [];
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i += 4) {
        // Initialise each pixel with the DC (average) value of each channel.
        let l = l_dc,
          p = p_dc,
          q = q_dc,
          a = a_dc;
        // Precompute cosine basis functions for this pixel's coordinates.
        // This avoids recomputing the same cos() values in the inner AC loops.
        for (let cx = 0; cx < max(lx, hasAlpha ? 5 : 3); cx++) fx[cx] = cos((PI / w) * (x + 0.5) * cx);
        for (let cy = 0; cy < max(ly, hasAlpha ? 5 : 3); cy++) fy[cy] = cos((PI / h) * (y + 0.5) * cy);
        // Accumulate AC contributions for the luminance channel.
        for (let cy = 0, j = 0; cy < ly; cy++)
          for (let cx = cy ? 0 : 1; cx * ly < lx * (ly - cy); cx++, j++) l += l_ac[j] * fx[cx] * fy[cy];
        // Accumulate AC contributions for the P and Q chroma channels.
        for (let cy = 0, j = 0; cy < 3; cy++)
          for (let cx = cy ? 0 : 1; cx < 3 - cy; cx++, j++) {
            let f = fx[cx] * fy[cy];
            p += p_ac[j] * f;
            q += q_ac[j] * f;
          }
        if (hasAlpha)
          for (let cy = 0, j = 0; cy < 5; cy++)
            for (let cx = cy ? 0 : 1; cx < 5 - cy; cx++, j++) a += a_ac[j] * fx[cx] * fy[cy];
        // Convert LPQ back to RGB. The formula inverts the encoding transform:
        //   L = (R+G+B)/3,  P = (R+G)/2 - B,  Q = R - G
        let b = l - (2 / 3) * p,
          r = (3 * l - b + q) / 2,
          g = r - q;
        rgba[i] = max(0, 255 * min(1, r));
        rgba[i + 1] = max(0, 255 * min(1, g));
        rgba[i + 2] = max(0, 255 * min(1, b));
        rgba[i + 3] = max(0, 255 * min(1, a));
      }
    }
    const result = { w, h, rgba };
    if (__PROFILE__) this.decodeProfiler!.record("process");
    return result;
  }
}
