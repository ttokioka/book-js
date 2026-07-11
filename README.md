# BookEngine

`BookEngine` は、JavaScript/TypeScript 環境で Excel ライクな数式を解析・計算するための軽量かつ強力な数式計算エンジンです。
UMD (Universal Module Definition) 形式に対応しており、ブラウザ環境（Script タグ）、Node.js (CommonJS)、AMD 環境のどこでも動作します。

## 特徴

* **依存関係の自動解決**: 数式セル同士の参照関係（`A1` が `B1` を参照するなど）を自動的に解析し、正しい順番でトポロジカルに計算します。
* **多彩なデータ構文**:
* 単一セル参照 (`A1`)・絶対参照 (`$A$1`)・シート指定参照 (`'Sheet1'!A1`)
* 範囲参照 (`A1:B2`, `$A$1:$B$2`) → 自動的に2次元配列として関数に引き渡されます。
* 配列リテラル (`{1,2;3,4}`)


* **単項演算子・冪乗計算のサポート**: 単項マイナス (`-A1`) や 冪乗 (`2^3`) などの柔軟な数式表現に対応。
* **カスタム関数と非同期（Promise）対応**: 独自の関数（`SUM` や `AVERAGE` など）を簡単に定義可能。非同期処理（APIリクエストなどを伴う関数）の完了を待ってから他のセルを計算させることも可能です。
* **堅牢な数値ハンドリング**: 計算処理における `NaN` や無効な数値変換の自動検知および制御。

---

## クイックスタート

### 1. 設置とインポート

#### Node.js (CommonJS)
```javascript
const BookEngine = require('./BookEngine.umd.js');

```

#### ブラウザ (Script タグ)

```html
<script src="BookEngine.umd.js"></script>

```

#### CDNの利用

```html
<script src="https://cdn.jsdelivr.net/gh/ttokioka/book-js@v1/BookEngine.umd.js"></script>

```

---

## 基本的な使い方

2次元配列（またはシート名を持ったオブジェクト）を用意し、数式にしたい箇所に `BookEngine.createFormula("数式")` で生成したオブジェクトを配置して `requestCalc()` を呼び出します。

```javascript
// 1. カスタム関数の定義（例: SUM関数）
const sumFunc = function(...args) {
  // 範囲参照 (A1:B2) は 2次元配列 [[1, 2], [3, 4]] として渡されるためフラット化して計算
  return args.flat(2).reduce((acc, val) => acc + (Number(val) || 0), 0);
};

// 2. エンジンのインスタンス化（関数を登録）
const engine = new BookEngine({
  SUM: sumFunc
});

// 3. ブック（データ構造）の定義
const book = {
  Sheet1: [
    [10, 20], // A1, B1
    [30, BookEngine.createFormula("-A1 + B1^2 + A2")] // A2, B2 (B2は -10 + 20^2 + 30 = 420 になる)
  ]
};

// 4. 計算の実行（非同期）
engine.requestCalc(book).then(result => {
  console.log(result.Sheet1);
  // 出力結果:
  // [
  //   [10, 20],
  //   [30, 420]
  // ]
});

```

---

## 応用的な機能

### 1. 範囲参照 (`A1:B2`) とカスタム関数

範囲参照を行うと、エンジンは指定されたエリアの値を2次元配列（`[[行1のセル, 行1のセル], [行2のセル, 行2のセル]]`）の形にしてカスタム関数に引数として渡します。

```javascript
// 配列内の数値をすべて掛け合わせる PRODUCT 関数
engine.defineFunction("PRODUCT", function(...args) {
  return args.flat(2).reduce((acc, val) => acc * (Number(val) || 1), 1);
});

const book = {
  Sheet1: [
    [2, 3], // A1, B1
    [4, BookEngine.createFormula("PRODUCT($A$1:$B$1)")] // A2, B2 -> 2 * 3 = 6
  ]
};

```

### 2. 他のシートの参照

`'シート名'!セル名` または `'シート名'!範囲` の構文を使って、別シートのデータを参照できます。

```javascript
const book = {
  "売上データ": [
    [1500] // A1
  ],
  "集計シート": [
    [BookEngine.createFormula("'売上データ'!$A$1 * 1.1")] // A1 -> 1500 * 1.1 = 1650
  ]
};

```

### 3. 非同期関数 (Promise) のサポート

外部APIからデータを取得するような非同期関数も、そのまま数式内で利用可能です。エンジンは Promise が解決されるのを待ってから、その値に依存している他のセルの計算を進めます。

```javascript
// 非同期で為替レートを取得する関数
engine.defineFunction("GET_RATE", async function(currency) {
  return new Promise(resolve => setTimeout(() => resolve(150), 500)); 
});

const book = {
  Sheet1: [
    [100, BookEngine.createFormula("GET_RATE(\"USD\")")], // A1, B1 (B1は非同期で150になる)
    [BookEngine.createFormula("A1 * B1")] // A2 (B1の解決を待ってから 100 * 150 = 15000 と計算される)
  ]
};

```

---

## API リファレンス

### `BookEngine` クラス

#### `static createFormula(formulaStr)`

文字列から数式AST（構文解析木）を生成します。

* **引数**: `formulaStr` (String) - `A1+B2` や `-SUM($A$1:$B$5)^2` などの数式文字列。
* **戻り値**: `FormulaAST` オブジェクト。

#### `constructor(...funcs)`

エンジンを初期化し、利用可能なカスタム関数群を登録します。

* **引数**: `funcs` (Object) - `{ キー名: 関数体 }` のオブジェクト。複数渡すとマージされます。

#### `defineFunction(name, func)`

後からカスタム関数を追加・上書き登録します。
関数名の先頭に `!` を付けると遅延評価 (Lazy Evaluation) モードで登録できます。

* **引数**:
* `name` (String) - 関数名（内部で自動的に大文字に変換されます）。
* `func` (Function) - 関数本体。



#### `async requestCalc(book)`

渡されたブックのデータを解析し、すべての数式セルを評価した結果を返します。

* **引数**: `book` (Object または 3次元配列)
* オブジェクト形式: `{ シート名: [[セル, セル], [セル, セル]] }`
* 配列形式: `[[[セル, セル]], [[セル, セル]]]` (シート名なしの3次元配列)


* **戻り値**: `Promise<Object|Array>` - 入力と同じ構造で、数式部分が計算後の値に置き換わったデータ。
* **例外**: 構文エラー（位置情報付き）、0での除算、数値変換エラー、または循環参照が検出された場合に適切なエラーをスローします。

---

## 構文仕様（シンタックス）

| 演算子 / 構文 | 説明 | 例 |
| --- | --- | --- |
| `+`, `-`, `*`, `/` | 四則演算（数値として評価） | `A1 * 1.1` |
| `-` / `+` (単項) | 単項演算子（符号反転 / 正数化） | `-A1`, `-(1 + 2)` |
| `^` | 冪乗（べき乗・右結合） | `2^3`, `A1^2` |
| `&` | 文字列の結合 | `"合計: " & A1` |
| `=`, `<>`, `<`, `<=`, `>`, `>=` | 比較演算子（真偽値 `TRUE`/`FALSE` を返す） | `A1 >= 100` |
| `{1,2;3,4}` | 配列リテラル（`,`で列区切り、`;`で行区切り） | `SUM({1,2;3,4})` |
| `A1` / `$A$1` | セル参照（相対参照・絶対参照記号 `$` 対応） | `$B$20`, `A$1` |
| `A1:B3` | 範囲参照（左上セル:右下セル） | `AVERAGE($A$1:$C$5)` |
| `'Sheet'!A1` | シングルクォーテーション囲みでのシート跨ぎ参照 | `'2026年データ'!$A$1` |
