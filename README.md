# ThumbHash Full-Stack Optimization Benchmark

<img src="https://img.shields.io/badge/TypeScript-optimized-blue?style=flat-square" alt="TypeScript">
<img src="https://img.shields.io/badge/encode-6.62x%20faster-brightgreen?labelColor=2f3232&style=flat-square" alt="encode speed">
<img src="https://img.shields.io/badge/decode-13.75x%20faster-brightgreen?labelColor=2f3232&style=flat-square" alt="decode speed">

ThumbHash の TypeScript 実装における低レイヤー最適化のベンチマーク・プロジェクトです。
アルゴリズムの数学的性質（DCT の対称性など）やブラウザの実行効率（Channel Fission, SWAR）を極限まで追求し、オリジナル実装に対して大幅な高速化を実現しています。

## Performance Highlights

AMD Ryzen 9 7900X 環境での計測結果：

| Task         | Original | Optimized   | Speedup    |
| :----------- | :------- | :---------- | :--------- |
| **Encode※1** | 402.5 ms | **63.6 ms** | **~6.33x** |
| **Decode※2** | 108.8 ms | **8.0 ms**  | **~13.6x** |

- ※1 1000回イテレーションの合計値。
- ※2 5000回イテレーションの合計値。

実行環境：Chrome 146 / Windows 11

## Optimization Techniques

本プロジェクトでは、以下の 7 つの主要な最適化手法を導入しています。

1.  **Symmetric DCT Folding**: DCT の対称性を利用し、計算量を削減。
2.  **Channel Fission**: CPU のパイプライン効率とメモリレイアウトを最適化。
3.  **SWAR (SIMD Within A Register)**: 単一のレジスタ内で複数のデータを並列処理。
4.  **Lookup Table Strategy**: 計算コストの高い関数の結果を事前計算。
5.  **Hot-path Inlining**: JIT コンパイラの最適化を加速させるためのインライン展開。
6.  **Loop Unrolling & Vectorization Friendly Code**: ブラウザの自動ベクトル化を促すコーディング。
7.  **Memory Access Optimization**: 不要なアロケーションを削減し、キャッシュ効率を向上。

## Project Structure

```text
src/
├── thumbhash-original.ts   # ベースラインとなるオリジナル実装
├── thumbhash-optimized.ts  # 極限まで最適化された実装
├── thumbhash-strategy.ts   # 共通インターフェース
├── profiler.ts             # ステップごとの実行時間計測ツール
├── index.ts                # エントリポイント
└── bench-ui.ts             # ベンチマーク結果の描画ロジック
bench.html                  # インタラクティブなベンチマーク UI
```

## Setup & Run

### 開発環境の起動

```bash
npm install
npm run dev
```

### ビルド

```bash
npm run build
```

## License

MIT License
