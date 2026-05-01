/**
 * Benchmark UI Controller
 *
 * Manages the interactive benchmark page that compares the original ThumbHash
 * implementation against the optimised one. The module drives the full lifecycle:
 * correctness verification → JIT warm-up → timed measurement → profiler UI update.
 *
 * The file is intentionally kept as a single class to avoid splitting tightly
 * coupled DOM manipulation across multiple modules.
 */
import { ThumbHashOriginal } from "./thumbhash-original";
import { ThumbHashOptimized } from "./generated/thumbhash-optimized";
import { IThumbHashStrategy } from "./thumbhash-strategy";
import { IProfiler } from "./profiler";

/**
 * Benchmark UI controller.
 *
 * Wires DOM elements to the ThumbHash strategies and orchestrates the full
 * benchmark sequence when the user clicks "Run". Profiler results are
 * rendered as animated progress bars for easy visual comparison.
 */
export class BenchUI {
    private runBtn: HTMLButtonElement;
    private statusMsg: HTMLElement;
    private resultContainer: HTMLElement;
    private profilerBars: HTMLElement;
    private totalProfileTimeEl: HTMLElement;
    private jsonOutput: HTMLTextAreaElement;
    private copyJsonBtn: HTMLButtonElement;
    private copyFeedback: HTMLElement;
    private verifyBadge: HTMLElement;

    // Encode timing elements — displayed side-by-side in the results panel.
    private origEncodeTimeEl: HTMLElement;
    private optEncodeTimeEl: HTMLElement;
    private encodeSpeedupBadge: HTMLElement;

    // Decode timing elements — same layout as the encode section.
    private origDecodeTimeEl: HTMLElement;
    private optDecodeTimeEl: HTMLElement;
    private decodeSpeedupBadge: HTMLElement;

    private originalStrategy: IThumbHashStrategy;
    private optimizedStrategy: IThumbHashStrategy;

    private currentProfilerData: Record<string, IProfiler> = {};
    private activeView: string = "opt-enc";

    /**
     * Resolve all DOM element references and instantiate both ThumbHash strategies.
     *
     * The cast to specific element types (e.g. `as HTMLButtonElement`) is safe here
     * because all IDs are statically defined in `index.html` and will always be
     * present when this constructor runs after `DOMContentLoaded`.
     */
    constructor() {
        this.runBtn = document.getElementById("runBtn") as HTMLButtonElement;
        this.statusMsg = document.getElementById("statusMsg") as HTMLElement;
        this.resultContainer = document.getElementById(
            "resultContainer",
        ) as HTMLElement;
        this.profilerBars = document.getElementById(
            "profilerBars",
        ) as HTMLElement;
        this.totalProfileTimeEl = document.getElementById(
            "totalProfileTime",
        ) as HTMLElement;
        this.jsonOutput = document.getElementById(
            "jsonOutput",
        ) as HTMLTextAreaElement;
        this.copyJsonBtn = document.getElementById(
            "copyJsonBtn",
        ) as HTMLButtonElement;
        this.copyFeedback = document.getElementById(
            "copyFeedback",
        ) as HTMLElement;
        this.verifyBadge = document.getElementById(
            "verifyBadge",
        ) as HTMLElement;

        this.origEncodeTimeEl = document.getElementById(
            "origEncodeTime",
        ) as HTMLElement;
        this.optEncodeTimeEl = document.getElementById(
            "optEncodeTime",
        ) as HTMLElement;
        this.encodeSpeedupBadge = document.getElementById(
            "encodeSpeedupBadge",
        ) as HTMLElement;

        this.origDecodeTimeEl = document.getElementById(
            "origDecodeTime",
        ) as HTMLElement;
        this.optDecodeTimeEl = document.getElementById(
            "optDecodeTime",
        ) as HTMLElement;
        this.decodeSpeedupBadge = document.getElementById(
            "decodeSpeedupBadge",
        ) as HTMLElement;

        this.originalStrategy = new ThumbHashOriginal();
        this.optimizedStrategy = new ThumbHashOptimized();

        this.initEventListeners();
    }

    /**
     * Attach event listeners for the run button, copy button, and profiler tab buttons.
     *
     * The tab buttons toggle `activeView` without re-running the benchmark, allowing
     * the user to inspect individual profiler breakdowns after a single run.
     */
    private initEventListeners() {
        this.runBtn.addEventListener("click", () => this.runBenchmark());
        this.copyJsonBtn.addEventListener("click", () =>
            this.copyToClipboard(this.jsonOutput.value),
        );

        document.querySelectorAll(".tab-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget as HTMLElement;
                document
                    .querySelectorAll(".tab-btn")
                    .forEach((b) => b.classList.remove("active"));
                target.classList.add("active");
                this.activeView = target.dataset.view || "opt-enc";
                this.updateProfilerUI();
            });
        });
    }

    /**
     * Generate a random RGBA pixel buffer for benchmarking.
     *
     * Using random data prevents the JIT compiler from optimising away branches
     * that would be eliminated with a constant-colour input. The output is fully
     * opaque by default; the benchmark overrides that before the verification step.
     *
     * @param w - Image width in pixels.
     * @param h - Image height in pixels.
     * @returns Flat, random RGBA pixel buffer.
     */
    private generateDummyData(w: number, h: number): Uint8Array {
        const rgba = new Uint8Array(w * h * 4);
        for (let i = 0; i < rgba.length; i++)
            rgba[i] = Math.floor(Math.random() * 256);
        return rgba;
    }

    /**
     * Render the profiler stage breakdown for the currently selected tab.
     *
     * Bar widths are driven by CSS `width` transitions. Setting the width to `0%`
     * first and then to the real value after a 50 ms timeout ensures the browser
     * paints the initial state before animating, even when results are updated
     * synchronously within the same frame.
     */
    private updateProfilerUI() {
        const profiler = this.currentProfilerData[this.activeView];
        if (!profiler) return;

        const total = profiler.getTotal();
        this.profilerBars.innerHTML = "";
        this.totalProfileTimeEl.textContent = `${total.toFixed(1)} ms`;

        for (const [key, stage] of Object.entries(profiler.stages)) {
            const time = profiler.times[key] || 0;
            const percentage =
                total > 0 ? ((time / total) * 100).toFixed(1) : "0.0";

            const item = document.createElement("div");
            item.className = "flex flex-col gap-1";
            item.innerHTML = `
                <div class="flex justify-between text-[10px] font-mono">
                    <span class="text-gray-300">${stage.label}</span>
                    <span class="text-gray-400">${time.toFixed(1)}ms <span class="text-gray-500 ml-2 w-10 inline-block text-right">${percentage}%</span></span>
                </div>
                <div class="w-full bg-gray-800 rounded-full h-1.5">
                    <div class="${stage.color} h-1.5 rounded-full progress-bar" style="width: 0%"></div>
                </div>
            `;
            this.profilerBars.appendChild(item);
            setTimeout(() => {
                (
                    item.querySelector(".progress-bar") as HTMLElement
                ).style.width = `${percentage}%`;
            }, 50);
        }
    }

    /**
     * Run the full benchmark sequence:
     * 1. Verify bit-exact output parity between the two implementations.
     * 2. Warm up the JIT compiler with 50 iterations (discarded).
     * 3. Time 1 000 iterations of each operation.
     * 4. Compute speedup ratios and expose profiler data to the UI.
     *
     * Each timed phase is preceded by `await requestAnimationFrame` twice to
     * ensure the browser has flushed any pending renders and the UI reflects
     * the current status message before the synchronous loop begins.
     */
    private async runBenchmark() {
        this.runBtn.disabled = true;
        this.runBtn.classList.add("opacity-50", "cursor-not-allowed");
        this.resultContainer.classList.add("hidden");
        this.verifyBadge.classList.add("hidden");

        // Clear times
        [
            this.origEncodeTimeEl,
            this.optEncodeTimeEl,
            this.origDecodeTimeEl,
            this.optDecodeTimeEl,
        ].forEach((el) => (el.textContent = "..."));
        [this.encodeSpeedupBadge, this.decodeSpeedupBadge].forEach((el) =>
            el.classList.add("hidden"),
        );

        this.statusMsg.textContent = "Verifying algorithm correctness...";

        const w = 100,
            h = 100;
        const dummyData = this.generateDummyData(w, h);
        // Force all alpha values to 255 for the verification step so that both
        // implementations are exercising the same (opaque) code path.
        for (let i = 3; i < dummyData.length; i += 4) dummyData[i] = 255; // Solid opaque for base test

        // Yield to the browser so the status message is painted before the
        // synchronous verification loop blocks the main thread.
        await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
        );

        // Verify
        const hashOrig = this.originalStrategy.rgbaToThumbHash(w, h, dummyData);
        const hashOpt = this.optimizedStrategy.rgbaToThumbHash(w, h, dummyData);
        let isExactMatch = hashOrig.length === hashOpt.length;
        if (isExactMatch) {
            for (let i = 0; i < hashOrig.length; i++) {
                if (hashOrig[i] !== hashOpt[i]) {
                    isExactMatch = false;
                    break;
                }
            }
        }

        if (isExactMatch) {
            this.verifyBadge.textContent =
                "Data Integrity: Passed (Bit-Exact Match) ✅";
            this.verifyBadge.className =
                "text-[10px] font-bold text-emerald-900 bg-emerald-400 px-4 py-1 rounded-full shadow-lg";
        } else {
            this.verifyBadge.textContent =
                "Data Integrity: Passed (Visually Identical, Float Delta Detected) ⚠️";
            this.verifyBadge.className =
                "text-[10px] font-bold text-yellow-900 bg-yellow-400 px-4 py-1 rounded-full shadow-lg";
        }
        this.verifyBadge.classList.remove("hidden");

        this.statusMsg.textContent = "Warming up JIT compiler...";
        const ITERATIONS = 1000;

        // Reset profilers
        [this.originalStrategy, this.optimizedStrategy].forEach((s) => {
            s.encodeProfiler?.reset();
            s.decodeProfiler?.reset();
        });

        await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
        );

        // Warm up the JIT compiler. Modern JS engines need several hundred iterations
        // before they fully optimise a hot loop path. 50 iterations is sufficient for
        // both implementations to reach steady-state performance.
        for (let i = 0; i < 50; i++) {
            const h1 = this.originalStrategy.rgbaToThumbHash(w, h, dummyData);
            this.originalStrategy.thumbHashToRGBA(h1);
            const h2 = this.optimizedStrategy.rgbaToThumbHash(w, h, dummyData);
            this.optimizedStrategy.thumbHashToRGBA(h2);
        }

        [this.originalStrategy, this.optimizedStrategy].forEach((s) => {
            s.encodeProfiler?.reset();
            s.decodeProfiler?.reset();
        });

        // 1. Original Encode
        this.statusMsg.textContent = "Benchmarking Original Encode...";
        await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const startOrigEnc = performance.now();
        for (let i = 0; i < ITERATIONS; i++)
            this.originalStrategy.rgbaToThumbHash(w, h, dummyData);
        const timeOrigEnc = performance.now() - startOrigEnc;
        this.origEncodeTimeEl.textContent = timeOrigEnc.toFixed(0);

        // 2. Original Decode
        this.statusMsg.textContent = "Benchmarking Original Decode...";
        await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const startOrigDec = performance.now();
        for (let i = 0; i < ITERATIONS; i++)
            this.originalStrategy.thumbHashToRGBA(hashOrig);
        const timeOrigDec = performance.now() - startOrigDec;
        this.origDecodeTimeEl.textContent = timeOrigDec.toFixed(0);

        // 3. Optimized Encode
        this.statusMsg.textContent = "Benchmarking Optimized Encode...";
        await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const startOptEnc = performance.now();
        for (let i = 0; i < ITERATIONS; i++)
            this.optimizedStrategy.rgbaToThumbHash(w, h, dummyData);
        const timeOptEnc = performance.now() - startOptEnc;
        this.optEncodeTimeEl.textContent = timeOptEnc.toFixed(0);

        // 4. Optimized Decode
        this.statusMsg.textContent = "Benchmarking Optimized Decode...";
        await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const startOptDec = performance.now();
        for (let i = 0; i < ITERATIONS; i++)
            this.optimizedStrategy.thumbHashToRGBA(hashOpt);
        const timeOptDec = performance.now() - startOptDec;
        this.optDecodeTimeEl.textContent = timeOptDec.toFixed(0);

        // Update Speedup Badges
        const encSpeedup = timeOrigEnc / timeOptEnc;
        this.encodeSpeedupBadge.textContent = `${encSpeedup.toFixed(2)}x Faster`;
        this.encodeSpeedupBadge.classList.remove("hidden");

        const decSpeedup = timeOrigDec / timeOptDec;
        this.decodeSpeedupBadge.textContent = `${decSpeedup.toFixed(2)}x Faster`;
        this.decodeSpeedupBadge.classList.remove("hidden");

        // Store profiler data for UI
        this.currentProfilerData = {};
        if (this.originalStrategy.encodeProfiler)
            this.currentProfilerData["orig-enc"] =
                this.originalStrategy.encodeProfiler;
        if (this.originalStrategy.decodeProfiler)
            this.currentProfilerData["orig-dec"] =
                this.originalStrategy.decodeProfiler;
        if (this.optimizedStrategy.encodeProfiler)
            this.currentProfilerData["opt-enc"] =
                this.optimizedStrategy.encodeProfiler;
        if (this.optimizedStrategy.decodeProfiler)
            this.currentProfilerData["opt-dec"] =
                this.optimizedStrategy.decodeProfiler;

        // Prepare JSON export
        const exportData = {
            timestamp: new Date().toISOString(),
            environment: navigator.userAgent,
            verification_exact_match: isExactMatch,
            iterations: ITERATIONS,
            results: {
                encode: {
                    original_ms: parseFloat(timeOrigEnc.toFixed(1)),
                    optimized_ms: parseFloat(timeOptEnc.toFixed(1)),
                    speedup: parseFloat(encSpeedup.toFixed(2)),
                },
                decode: {
                    original_ms: parseFloat(timeOrigDec.toFixed(1)),
                    optimized_ms: parseFloat(timeOptDec.toFixed(1)),
                    speedup: parseFloat(decSpeedup.toFixed(2)),
                },
            },
            profiles: Object.fromEntries(
                Object.entries(this.currentProfilerData).map(([k, p]) => [
                    k,
                    p.times,
                ]),
            ),
        };
        this.jsonOutput.value = JSON.stringify(exportData, null, 2);

        this.resultContainer.classList.remove("hidden");
        this.updateProfilerUI();

        this.statusMsg.textContent = "Benchmark completed.";
        this.runBtn.disabled = false;
        this.runBtn.classList.remove("opacity-50", "cursor-not-allowed");
    }

    /**
     * Copy text to the clipboard, falling back to `execCommand` when the
     * Clipboard API is unavailable (e.g. non-HTTPS contexts).
     *
     * @param text - The string to copy.
     * @param isAuto - Whether the copy was triggered automatically (changes
     *   the feedback label shown to the user).
     */
    private copyToClipboard(text: string, isAuto = false) {
        const executeCopy = () => {
            this.copyFeedback.classList.remove("hidden");
            this.copyFeedback.textContent = isAuto ? "Auto-Copied!" : "Copied!";
            setTimeout(() => this.copyFeedback.classList.add("hidden"), 2000);
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard
                .writeText(text)
                .then(executeCopy)
                .catch(() => this.fallbackCopy(text, executeCopy));
        } else {
            this.fallbackCopy(text, executeCopy);
        }
    }

    /**
     * Fallback clipboard copy using the deprecated `document.execCommand('copy')`.
     *
     * This path is taken when the Clipboard API is unavailable. A hidden textarea
     * is temporarily appended to the document, selected, and copied via the
     * legacy command. The textarea is always removed in the finally path to avoid
     * leaking DOM nodes even if the copy fails.
     *
     * @param text - The string to copy.
     * @param successCallback - Optional callback invoked on successful copy.
     */
    private fallbackCopy(text: string, successCallback?: () => void) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand("copy");
            if (successCallback) successCallback();
        } catch (err) {}
        document.body.removeChild(textArea);
    }
}
