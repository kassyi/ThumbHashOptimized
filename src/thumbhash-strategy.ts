/**
 * ThumbHash Strategy Types
 *
 * Defines the contract for ThumbHash encoding and decoding implementations.
 * The interface expresses **what** operations are required; comments explain **why**
 * each method exists and how it fits into the overall ThumbHash pipeline.
 */
import { IProfiler } from "./profiler";

export interface ThumbHashImage {
  w: number;
  h: number;
  rgba: Uint8Array | Uint8ClampedArray;
}

export interface IThumbHashStrategy {
  readonly encodeProfiler?: IProfiler;
  readonly decodeProfiler?: IProfiler;

  /**
 * Encode an RGBA image into a ThumbHash.
 *
 * @param w - Width of the source image in pixels.
 * @param h - Height of the source image in pixels.
 * @param rgba - Flat RGBA pixel buffer (Uint8Array or Uint8ClampedArray).
 * @returns Uint8Array containing the ThumbHash bytes.
 *
 * This method is the entry point for converting raw pixel data into the compact
 * ThumbHash representation. Implementations may apply fast‑path optimisations
 * when the image lacks an alpha channel.
 */
rgbaToThumbHash(w: number, h: number, rgba: Uint8Array | Uint8ClampedArray): Uint8Array;

/**
 * Decode a ThumbHash back to RGBA pixel data.
 *
 * @param hash - ThumbHash byte array produced by {@link rgbaToThumbHash}.
 * @returns An object containing width, height, and a Uint8Array of RGBA pixels.
 *
 * The decoder reconstructs the original image using the inverse DCT and the
 * stored DC/AC coefficients. It mirrors the encoder's optimisation strategy.
 */
thumbHashToRGBA(hash: Uint8Array): ThumbHashImage;
}
