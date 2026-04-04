# ThumbHash Optimized Implementation

<img src="https://img.shields.io/badge/TypeScript-optimized-blue?style=flat-square" alt="TypeScript">
<img src="https://img.shields.io/badge/encode-6.3x%20faster-brightgreen?labelColor=2f3232&style=flat-square" alt="encode speed">
<img src="https://img.shields.io/badge/decode-13.6x%20faster-brightgreen?labelColor=2f3232&style=flat-square" alt="decode speed">

This project is a high-performance benchmark project comparing the original ThumbHash implementation with a fully optimized version in TypeScript.
It leverages mathematical properties of algorithms (such as DCT symmetry) and browser execution efficiency (Channel Fission, SWAR, Loop Unrolling) to achieve massive speed boosts.

## Performance Highlights

Measured on AMD Ryzen 9 7900X:

| Task          | Original | Optimized   | Speedup    |
| :------------ | :------- | :---------- | :--------- |
| **Encode**[1] | 402.5 ms | **63.6 ms** | **~6.3x**  |
| **Decode**[2] | 108.8 ms | **8.0 ms**  | **~13.6x** |

- [1] Total time for 1,000 iterations.
- [2] Total time for 5,000 iterations.

_Environment: Chrome 146 / Windows 11_

## Optimization Techniques

The project implements seven key optimization strategies:

1.  **Symmetric DCT Folding**: Reduces computational complexity by exploiting DCT symmetry.
2.  **Channel Fission**: Optimizes CPU pipeline efficiency and memory layout by processing color channels independently.
3.  **SWAR (SIMD Within A Register)**: Performs parallel data processing within a single register (e.g., handling multiple color channels in one operation).
4.  **Lookup Table Strategy**: Precomputes results for computationally expensive functions to avoid runtime overhead.
5.  **Hot-path Inlining**: Forces critical path inlining to assist JIT compiler optimizations.
6.  **Loop Unrolling & Vectorization**: Aggressive loop unrolling via a code generation pipeline to encourage browser auto-vectorization.
7.  **Memory Access Optimization**: Minimizes allocations and improves cache efficiency through typed arrays and linear access patterns.

## Generation Pipeline (EJS + TypeScript Templates)

To achieve maximum performance (particularly for loop unrolling and pre-computed blocks), this project uses a specialized code generation pipeline.

- **Model-View-Template Pattern**: Complex loop unrolling and mathematical logic are extracted into **TypeScript Generators** (`scripts/generators/`).
- **EJS Templates**: The structural algorithm logic and boilerplate are defined in `src/templates/thumbhash-optimized.ts.ejs`.
- **Pre-build Automation**: The `npm run generate` command (running automatically before `npm run build`) injects generated code blocks into the EJS template to produce the high-performance implementation in `src/generated/thumbhash-optimized.ts`.

This architecture allows the source code to remain maintainable while the final artifact is a highly-tuned, hard-coded implementation that maximizes throughput.

## Project Structure

```text
src/
├── templates/          # EJS templates for code generation
├── generated/          # Auto-generated optimized implementation
├── thumbhash-original.ts # Baseline original implementation
├── thumbhash-strategy.ts # Common interface for benchmarking
├── profiler.ts          # Execution time measurement for specific stages
├── index.ts             # Application entry point
└── bench-ui.ts          # Benchmark UI and orchestration logic
scripts/
├── generators/         # Domain-specific code generation logic (TypeScript)
└── generate-thumbhash.ts # Pipeline runner script
bench.html               # Interactive benchmark UI
```

## Setup & Run

### Development

Start the development server with Hot Module Replacement (HMR):

```bash
npm install
npm run dev
```

### Build

Build the production bundle. This command automatically triggers the code generation pipeline via `prebuild`.

```bash
npm run build
```

## License

MIT License
