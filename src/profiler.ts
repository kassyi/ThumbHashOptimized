/**
 * プロファイラユーティリティ
 *
 * ThumbHash ベンチマーク用の軽量パフォーマンスプロファイラを提供します。
 * 型は **何** を測定するかを表し、コメントは各ステージが **なぜ** 必要かを説明します。
 *
 * プロファイラは各ステージの経過時間を記録し、エンコード/デコードパイプラインのボトルネック特定に役立ちます。
 */
export interface ProfilerResults {
    [stage: string]: number;
}

/**
 * プロファイリングステージの説明。
 *
 * @property label UI に表示される人間可読な名前。
 * @property color ビジュアル区別に使用する Tailwind スタイルのカラークラス。
 */
export interface ProfilerStage {
    label: string;
    color: string;
}

/**
 * プロファイラの公開 API。
 *
 * このインターフェースはプロジェクト全体で使用される契約を定義します。
 */
export interface IProfiler {
    readonly times: ProfilerResults;
    readonly stages: Record<string, ProfilerStage>;
    reset(): void;
    start(): void;
    record(stage: string): void;
    getTotal(): number;
}

/**
 * 具体的な Profiler 実装。
 *
 * @param stages ステージ識別子とそのビジュアルメタデータのマッピング。
 *   呼び出し元（ThumbHashOptimized 参照）から提供され、UI が各プロファイリングセグメントを異なる色で描画できるようにします。
 */
export class Profiler implements IProfiler {
    public times: ProfilerResults = {};
    private startTime: number = 0;

    constructor(public readonly stages: Record<string, ProfilerStage>) {
        this.reset();
    }

    /**
     * 記録された全ての時間を 0 にリセットします。
     *
     * ベンチマークを複数回実行する際に Profiler インスタンスを再利用するために有用です。
     * `this.stages` を走査することで、全ての定義済みステージに `this.times` のエントリが確実に存在し、後続で `undefined` が出るのを防ぎます。
     */
    public reset(): void {
        for (const key in this.stages) {
            this.times[key] = 0;
        }
    }

    /**
     * プロファイリング区間の開始をマークします。
     *
     * `performance.now()` は高解像度のタイムスタンプを提供します。これを `this.startTime` に保存することで、後続の `record` 呼び出しで経過時間を算出できます。
     */
    public start(): void {
        this.startTime = performance.now();
    }

    /**
     * 指定されたステージの経過時間を記録し、次のステージの準備を行います。
     *
     * @param stage プロファイリングステージの識別子（`this.stages` に存在する必要があります）。
     *
     * 現在のタイムスタンプと以前に保存された `startTime` の差分を計算します。
     * 既にステージが記録されている場合は時間を加算し、未記録の場合は `startTime` を更新するだけで値は保存しません。
     * この設計により、不要なキーの生成を防ぎつつ、ステージの動的な順序付けをサポートします。
     */
    public record(stage: string): void {
        const now = performance.now();
        if (this.times[stage] !== undefined) {
            this.times[stage] += now - this.startTime;
        }
        this.startTime = now;
    }

    /**
     * 全ステージの累積時間の合計を計算します。
     *
     * 主に UI にベンチマーク全体の所要時間を表示するために使用されます。
     * `record` 呼び出しで蓄積された `this.times` の値を合計します。
     */
    public getTotal(): number {
        return Object.values(this.times).reduce((a, b) => a + b, 0);
    }
}
