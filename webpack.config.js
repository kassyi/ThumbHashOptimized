import path from "path";
import { fileURLToPath } from "url";
import webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseConfig = {
    mode: "production",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
};

const appConfig = {
    ...baseConfig,
    name: "app",
    entry: "./src/index.ts",
    output: {
        filename: "thumbhash-optimized-benchmark.js",
        path: path.resolve(__dirname, "dist"),
        // No cleaning here during parallel build
        clean: false,
    },
    plugins: [
        new webpack.DefinePlugin({
            __PROFILE__: JSON.stringify(true),
        }),
        new HtmlWebpackPlugin({
            template: "bench.html",
            filename: "index.html",
        }),
    ],
};

const libConfig = {
    ...baseConfig,
    name: "lib",
    entry: "./src/generated/thumbhash-optimized.ts",
    output: {
        filename: "thumbhash-optimized.js",
        path: path.resolve(__dirname, "dist"),
        library: {
            type: "module",
        },
        clean: false,
    },
    experiments: {
        outputModule: true,
    },
    plugins: [
        new webpack.DefinePlugin({
            __PROFILE__: JSON.stringify(false),
        }),
    ],
};

export default [appConfig, libConfig];
