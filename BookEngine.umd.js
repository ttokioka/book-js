/** 簡易数式計算エンジン */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BookEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';
class FormulaLexer {
  static tokenize(formulaStr) {
    let src = formulaStr.trim();

    const tokens = [];
    let i = 0;

    while (i < src.length) {
      const char = src[i];

      // 1. 空白のスキップ
      if (/\s/.test(char)) { i++; continue; }

      // 2. 演算子・区切り文字
      const twoCharOp = src.substr(i, 2);
      if (['<>', '<=', '>='].includes(twoCharOp)) {
        tokens.push({ type: 'Operator', value: twoCharOp });
        i += 2;
        continue;
      }
      if (['&', '+', '-', '*', '/', '(', ')', ',', '{', '}', ';', '=', '<', '>'].includes(char)) {
        tokens.push({ type: 'Operator', value: char });
        i++;
        continue;
      }
      
      // 3. 文字列リテラル
      if (char === '"') {
        let valueStr = '';
        i++; // 開始の '"' をスキップ

        while (i < src.length) {
          if (src[i] === '"') {
            // 次の文字も '"' ならエスケープとみなす
            if (src[i + 1] === '"') {
              valueStr += '"';
              i += 2; // "" の2文字分進める
            } else {
              i++; // 閉じの '"' をスキップ
              break;
            }
          } else {
            valueStr += src[i];
            i++;
          }
        }
        tokens.push({ type: 'String', value: valueStr });
        continue;
      }

      // 4. 数値リテラル
      if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(src[i + 1]))) {
        let valueStr = '';
        while (i < src.length && /[0-9.]/.test(src[i])) {
          valueStr += src[i];
          i++;
        }
        tokens.push({ type: 'Number', value: Number(valueStr) });
        continue;
      }

      // 5. セル参照、関数名、あるいはシート名付き参照 / TRUE, FALSE
      if (char === "'" || /[A-Za-z_]/.test(char)) {
        let identStr = '';
        
        if (char === "'") {
          let inQuote = true;
          identStr += src[i]; // "'"
          i++;
          while (i < src.length && inQuote) {
            identStr += src[i];
            if (src[i] === "'") inQuote = false;
            i++;
          }
        }
        
        while (i < src.length && /[A-Za-z0-9_!:]/.test(src[i])) {
          identStr += src[i];
          i++;
        }
        
        if (src[i] === '(') {
          tokens.push({ type: 'FunctionName', value: identStr.toUpperCase() });
        } else if (identStr.toUpperCase() === 'TRUE') {
          tokens.push({ type: 'Boolean', value: true });
        } else if (identStr.toUpperCase() === 'FALSE') {
          tokens.push({ type: 'Boolean', value: false });
        } else {
          tokens.push({ type: 'Reference', value: identStr });
        }
        continue;
      }

      throw new SyntaxError(`未対応の文字が含まれています: "${char}" (位置: ${i})`);
    }

    // 構文解析をしやすくするため、終端トークンを追加
    tokens.push({ type: 'EOF', value: null });
    return tokens;
  }
}

class FormulaParser {
  static parse(tokens) {
    let current = 0;

    function peek() { return tokens[current]; }
    function consume(type) {
      const token = peek();
      if (type && token.type !== type) {
        throw new SyntaxError(`予期しないトークン: ${token.value}, 期待値: ${type}`);
      }
      current++;
      return token;
    }

    // 配列リテラル {1,2;3,4} のパース
    function parseArrayLiteral() {
      consume('Operator', '{');
      const matrix = [];
      let currentRow = [];

      // 空の配列リテラル {} はエラー（仕様に合わせる）
      if (peek().value === '}') {
        throw new SyntaxError("空の配列リテラルは許可されていません");
      }

      while (true) {
        // 各要素は単純なリテラル（数値や文字列など式を展開）
        // ※Excel仕様に準拠し、配列の中身は静的な式（Expression）として評価
        currentRow.push(parseExpression());

        const next = peek();
        if (next.value === ',') {
          consume('Operator', ',');
        } else if (next.value === ';') {
          consume('Operator', ';');
          matrix.push(currentRow);
          currentRow = [];
        } else if (next.value === '}') {
          matrix.push(currentRow);
          consume('Operator', '}');
          break;
        } else {
          throw new SyntaxError(`配列リテラル内の不正な区切り文字: ${next.value}`);
        }
      }

      // 行ごとの列数が一致しているかバリデーション（オプション）
      const colCount = matrix[0].length;
      for (const row of matrix) {
        if (row.length !== colCount) {
          throw new SyntaxError("配列リテラルの行ごとの列数が一致していません");
        }
      }

      return { type: 'ArrayLiteral', matrix };
    }

    // 一番優先度の高い要素（数値、セル参照、関数、カッコ）をパース
    function parsePrimary() {
      const token = peek();
      
      if (token.value === '{') {
        return parseArrayLiteral();
      }

      if (token.type === 'String') {
        consume('String');
        return { type: 'Literal', value: token.value };
      }

      if (token.type === 'Number') {
        consume('Number');
        return { type: 'Literal', value: token.value };
      }

      if (token.type === 'Boolean') {
        consume('Boolean');
        return { type: 'Literal', value: token.value };
      }

      if (token.type === 'Reference') {
        consume('Reference');
        return { type: 'Reference', raw: token.value };
      }

      if (token.type === 'FunctionName') {
        consume('FunctionName');
        consume('Operator'); // '(' を消費
        
        const args = [];
        // 引数リストのパース (SUM(A1, B2, 3) など)
        if (peek().value !== ')') {
          args.push(parseExpression());
          while (peek().value === ',') {
            consume('Operator'); // ',' を消費
            args.push(parseExpression());
          }
        }
        
        const closing = consume('Operator'); // ')' を消費
        if (closing.value !== ')') throw new SyntaxError("関数呼び出しの閉じカッコがありません");
        
        return { type: 'CallExpression', callee: token.value.toUpperCase(), arguments: args };
      }

      if (token.value === '(') {
        consume('Operator');
        const expr = parseExpression();
        const closing = consume('Operator');
        if (closing.value !== ')') throw new SyntaxError("閉じカッコがありません");
        return expr;
      }

      throw new SyntaxError(`パースエラー: 予期しないトークン ${token.value}`);
    }

    // 二項演算子の優先順位を制御しながらパース
    function parseExpression() {
      return parseBinaryExpression(0);
    }

    // 演算子の優先順位の定義
    const PRECEDENCE = { 
      '=': 1, '<>': 1, '<': 1, '<=': 1, '>': 1, '>=': 1,
      '&': 2, 
      '+': 3, '-': 3, 
      '*': 4, '/': 4 
    };

    function parseBinaryExpression(parentPrecedence) {
      let left = parsePrimary();

      while (true) {
        const token = peek();
        if (token.type !== 'Operator' || !PRECEDENCE[token.value]) {
          break;
        }

        const precedence = PRECEDENCE[token.value];
        // 親の演算子より優先度が低ければループを抜ける
        if (precedence <= parentPrecedence) {
          break;
        }

        const opToken = consume('Operator');
        // 右辺を再帰的にパース（現在の優先度を渡す）
        const right = parseBinaryExpression(precedence);
        left = { type: 'BinaryExpression', operator: opToken.value, left: left, right: right };
      }

      return left;
    }

    const ast = parseExpression();
    if (peek().type !== 'EOF') {
      throw new SyntaxError("数式のパース完了前に終端に達しませんでした（不正な構文）");
    }
    return ast;
  }
}

class FormulaAST {
  constructor(ast) {
    this.ast = ast;
  }
}

class BookReference {
  constructor(options) {
    // options: { type: 'cell'|'range', sheetNo, start, end }
    this.type = options.type;
    this.sheetNo = options.sheetNo;
    this.start = options.start; // { rowNo, columnNo }
    this.end = options.end || options.start; // range の場合の終点
  }

  /**
   * 現在の参照に対応する値を計算結果(values)から取得します。
   * Pending状態が含まれる場合は Symbol('pending') を返します。
   */
  getValue(values, PendingSymbol) {
    const sheet = values[this.sheetNo];

    if (this.type === 'cell') {
      if (!sheet || !sheet[this.start.rowNo]) return 0;
      const val = sheet[this.start.rowNo][this.start.columnNo];
      if (val === PendingSymbol) return PendingSymbol;
      return val === undefined ? 0 : val;
    }

    if (this.type === 'range') {
      const startRow = Math.min(this.start.rowNo, this.end.rowNo);
      const endRow = Math.max(this.start.rowNo, this.end.rowNo);
      const startCol = Math.min(this.start.columnNo, this.end.columnNo);
      const endCol = Math.max(this.start.columnNo, this.end.columnNo);

      const rangeValues = [];
      for (let r = startRow; r <= endRow; r++) {
        const rowValues = [];
        for (let c = startCol; c <= endCol; c++) {
          const val = (sheet && sheet[r]) ? sheet[r][c] : undefined;
          if (val === PendingSymbol) return PendingSymbol;
          rowValues.push(val === undefined ? 0 : val);
        }
        rangeValues.push(rowValues);
      }
      return rangeValues;
    }

    return 0;
  }

  /**
   * OFFSET等で参照を移動・サイズ変更した新しい BookReference を作成します。
   */
  offset(rowOffset, colOffset, height, width) {
    const newStartRow = this.start.rowNo + rowOffset;
    const newStartCol = this.start.columnNo + colOffset;

    const targetHeight = (height !== undefined && height !== null) 
      ? height 
      : (Math.abs(this.end.rowNo - this.start.rowNo) + 1);

    const targetWidth = (width !== undefined && width !== null) 
      ? width 
      : (Math.abs(this.end.columnNo - this.start.columnNo) + 1);

    const newEndRow = newStartRow + targetHeight - 1;
    const newEndCol = newStartCol + targetWidth - 1;

    const isRange = targetHeight > 1 || targetWidth > 1;

    return new BookReference({
      type: isRange ? 'range' : 'cell',
      sheetNo: this.sheetNo,
      start: { rowNo: newStartRow, columnNo: newStartCol },
      end: { rowNo: newEndRow, columnNo: newEndCol }
    });
  }
}

class BookEngine {
  static Pending = Symbol('pending');
  static createFormula(formula) {
    const tokens = FormulaLexer.tokenize(formula);
    return new FormulaAST(FormulaParser.parse(tokens));
  }
  constructor(...funcs) {
    this.definedFunctions = {};
    if (funcs.length > 0) {
      for (const funcMap of funcs) {
        for (const [name, fn] of Object.entries(funcMap)) {
          this.defineFunction(name, fn);
        }
      }
    }
  }
  async requestCalc(book) {
    let formulaQueue = [];
    const sheets = {};
    const iterableBook = ((typeof book === 'object') && (typeof book[Symbol.iterator] !== 'function'))
      ? Array.from(Object.entries(book), entry => { return { name: entry[0], data: entry[1], *[Symbol.iterator]() { return yield* this.data; } }; })
      : book;
    const values = Array.from(iterableBook, (sheet, sheetNo) => {
      sheets[sheet.name] = sheetNo;
      return Array.from(sheet, (row, rowNo) =>
        Array.from(row, (cell, columnNo) => {
          if (cell instanceof FormulaAST) {
            const formula = cell.ast;
            formulaQueue.push({sheetNo, rowNo, columnNo, formula});
            return this.constructor.Pending;
          }
          return cell;
        })
      );
    });
    while (formulaQueue.length > 0) {
      const nextQueue = [];
      const promiseList = [];
      for (const ctx of formulaQueue) {
        const value = this.calc(ctx, values, sheets);
        if (value instanceof Promise) {
          promiseList.push(value.then(result => {
            if (result === this.constructor.Pending) {
              nextQueue.push(ctx);
              return;
            }
            const { sheetNo, rowNo, columnNo } = ctx;
            values[sheetNo][rowNo][columnNo] = result;
          }));
          continue;
        }
        if (value === this.constructor.Pending) {
          nextQueue.push(ctx);
          continue;
        }
        const { sheetNo, rowNo, columnNo } = ctx;
        values[sheetNo][rowNo][columnNo] = value;
      }
      await Promise.all(promiseList);
      if (nextQueue.length === formulaQueue.length) {
        throw new Error("解決できない参照先");
      }
      formulaQueue = nextQueue;
    }
    if (iterableBook != book) {
      return Object.fromEntries(Array.from(Object.entries(sheets), entry => [entry[0], values[entry[1]]]));
    }
    return values;
  }
  calc(ctx, values, sheets) {
    const Pending = this.constructor.Pending;

    // 単一セル文字 ("A1") を { rowNo, columnNo } に変換するヘルパー
    const parseSingleCell = (str) => {
      const match = str.match(/^([A-Za-z]+)([0-9]+)$/);
      if (!match) throw new Error(`不正なセル参照です: ${str}`);
      
      const colStr = match[1].toUpperCase();
      let columnNo = 0;
      for (let i = 0; i < colStr.length; i++) {
        columnNo = columnNo * 26 + (colStr.charCodeAt(i) - 64);
      }
      columnNo--;
      const rowNo = parseInt(match[2], 10) - 1;
      return { rowNo, columnNo };
    };

    // セル参照文字列から BookReference インスタンスを生成
    const parseReference = (refStr) => {
      let sheetNo = ctx.sheetNo;
      let cellStr = refStr;

      if (refStr.includes('!')) {
        const parts = refStr.split('!');
        let sheetName = parts[0];
        cellStr = parts[1];

        if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
          sheetName = sheetName.slice(1, -1);
        }

        sheetNo = sheets[sheetName];
        if (sheetNo === undefined) throw new Error(`存在しないシート名です: ${sheetName}`);
      }

      if (cellStr.includes(':')) {
        const [startRef, endRef] = cellStr.split(':');
        return new BookReference({
          type: 'range',
          sheetNo,
          start: parseSingleCell(startRef),
          end: parseSingleCell(endRef)
        });
      }

      return new BookReference({
        type: 'cell',
        sheetNo,
        start: parseSingleCell(cellStr)
      });
    };

    // BookReference または 生の値を、値(または二次元配列)へと解決するヘルパー
    const resolveValue = (val) => {
      if (val instanceof BookReference) {
        return val.getValue(values, Pending);
      }
      return val;
    };

    // ASTノード評価
    const evaluate = (node) => {
      if (!node) return 0;

      switch (node.type) {
        case 'Literal':
          return node.value;

        case 'ArrayLiteral': {
          const evaluatedMatrix = [];
          for (const row of node.matrix) {
            const evaluatedRow = [];
            for (const cellNode of row) {
              const val = resolveValue(evaluate(cellNode));
              if (val === Pending) return Pending;
              evaluatedRow.push(val);
            }
            evaluatedMatrix.push(evaluatedRow);
          }
          return evaluatedMatrix;
        }

        case 'Reference': {
          return parseReference(node.raw);
        }

        case 'BinaryExpression': {
          let leftVal = resolveValue(evaluate(node.left));
          if (leftVal === Pending) return Pending;

          let rightVal = resolveValue(evaluate(node.right));
          if (rightVal === Pending) return Pending;

          switch (node.operator) {
            case '&': return `${leftVal}${rightVal}`;
            case '+': return Number(leftVal) + Number(rightVal);
            case '-': return Number(leftVal) - Number(rightVal);
            case '*': return Number(leftVal) * Number(rightVal);
            case '/': 
              if (Number(rightVal) === 0) throw new Error("0での除算が発生しました");
              return Number(leftVal) / Number(rightVal);
            case '=': return leftVal == rightVal;
            case '<>': return leftVal != rightVal;
            case '<': return leftVal < rightVal;
            case '<=': return leftVal <= rightVal;
            case '>': return leftVal > rightVal;
            case '>=': return leftVal >= rightVal;
            default:
              throw new Error(`未対応の演算子です: ${node.operator}`);
          }
        }

        case 'CallExpression': {
          const funcObj = this.definedFunctions[node.callee];
          if (!funcObj) {
            throw new Error(`未定義の関数です: ${node.callee}`);
          }

          const context = {
            caller: ctx,
            sheets: sheets,
            evaluate: (targetNode) => resolveValue(evaluate(targetNode))
          };

          if (funcObj.isLazy) {
            // 遅延評価モード: ASTノードを直接渡し、関数内で必要になったタイミングで context.evaluate を呼ぶ
            return funcObj.fn.apply({ Pending, context }, node.arguments);
          } else {
            // 通常の評価モード: 先に引数をすべて評価してから関数に渡す
            const evaluatedArgs = [];
            context.arguments = [];
            for (const argNode of node.arguments) {
              const rawArg = evaluate(argNode);

              if (rawArg === Pending) return Pending;

              if (rawArg instanceof BookReference) {
                context.arguments.push(rawArg);
                const resolved = rawArg.getValue(values, Pending);
                if (resolved === Pending) return Pending;
                evaluatedArgs.push(resolved);
              } else {
                context.arguments.push({ type: 'value', value: rawArg });
                evaluatedArgs.push(rawArg);
              }
            }
            return funcObj.fn.apply({ Pending, context }, evaluatedArgs);
          }
        }

        default:
          throw new Error(`未知のASTノードタイプです: ${node.type}`);
      }
    };

    const result = evaluate(ctx.formula);
    return resolveValue(result);
  }

  defineFunction(name, func) {
    const isLazy = name.startsWith('!');
    const cleanName = isLazy ? name.slice(1).toUpperCase() : name.toUpperCase();
    this.definedFunctions[cleanName] = {
      fn: func,
      isLazy: isLazy
    };
  }
}
return BookEngine;
}));