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
      const startIndex = i;

      // 1. 空白のスキップ
      if (/\s/.test(char)) { i++; continue; }

      // 2. 演算子・区切り文字
      const twoCharOp = src.substr(i, 2);
      if (['<>', '<=', '>='].includes(twoCharOp)) {
        tokens.push({ type: 'Operator', value: twoCharOp, index: startIndex });
        i += 2;
        continue;
      }
      if (['&', '+', '-', '*', '/', '^', '(', ')', ',', '{', '}', ';', '=', '<', '>'].includes(char)) {
        tokens.push({ type: 'Operator', value: char, index: startIndex });
        i++;
        continue;
      }
      
      // 3. 文字列リテラル
      if (char === '"') {
        let valueStr = '';
        i++; // 開始の '"' をスキップ

        while (i < src.length) {
          if (src[i] === '"') {
            if (src[i + 1] === '"') {
              valueStr += '"';
              i += 2;
            } else {
              i++; // 閉じの '"' をスキップ
              break;
            }
          } else {
            valueStr += src[i];
            i++;
          }
        }
        tokens.push({ type: 'String', value: valueStr, index: startIndex });
        continue;
      }

      // 4. 数値リテラル
      if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(src[i + 1]))) {
        let valueStr = '';
        while (i < src.length && /[0-9.]/.test(src[i])) {
          valueStr += src[i];
          i++;
        }
        const parsedNum = Number(valueStr);
        if (isNaN(parsedNum)) {
          throw new SyntaxError(`不正な数値リテラルです: "${valueStr}" (位置: ${startIndex})`);
        }
        tokens.push({ type: 'Number', value: parsedNum, index: startIndex });
        continue;
      }

      // 5. セル参照 (絶対参照 $ 対応)、関数名、またはシート名付き参照 / TRUE, FALSE
      if (char === "'" || char === '$' || /[A-Za-z_]/.test(char)) {
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
        
        // $ マーク、英数字、_、!、: を許容
        while (i < src.length && /[A-Za-z0-9_!:$]/.test(src[i])) {
          identStr += src[i];
          i++;
        }
        
        if (src[i] === '(') {
          tokens.push({ type: 'FunctionName', value: identStr.toUpperCase(), index: startIndex });
        } else if (identStr.toUpperCase() === 'TRUE') {
          tokens.push({ type: 'Boolean', value: true, index: startIndex });
        } else if (identStr.toUpperCase() === 'FALSE') {
          tokens.push({ type: 'Boolean', value: false, index: startIndex });
        } else {
          tokens.push({ type: 'Reference', value: identStr, index: startIndex });
        }
        continue;
      }

      throw new SyntaxError(`未対応の文字が含まれています: "${char}" (位置: ${i})`);
    }

    tokens.push({ type: 'EOF', value: null, index: i });
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
        throw new SyntaxError(`予期しないトークン: "${token.value}" (位置: ${token.index}), 期待値: ${type}`);
      }
      current++;
      return token;
    }

    // 配列リテラル {1,2;3,4}
    function parseArrayLiteral() {
      const startToken = consume('Operator'); // '{'
      const matrix = [];
      let currentRow = [];

      if (peek().value === '}') {
        throw new SyntaxError(`空の配列リテラルは許可されていません (位置: ${startToken.index})`);
      }

      while (true) {
        currentRow.push(parseExpression());

        const next = peek();
        if (next.value === ',') {
          consume('Operator');
        } else if (next.value === ';') {
          consume('Operator');
          matrix.push(currentRow);
          currentRow = [];
        } else if (next.value === '}') {
          matrix.push(currentRow);
          consume('Operator');
          break;
        } else {
          throw new SyntaxError(`配列リテラル内の不正な区切り文字: "${next.value}" (位置: ${next.index})`);
        }
      }

      const colCount = matrix[0].length;
      for (const row of matrix) {
        if (row.length !== colCount) {
          throw new SyntaxError(`配列リテラルの行ごとの列数が一致していません (位置: ${startToken.index})`);
        }
      }

      return { type: 'ArrayLiteral', matrix };
    }

    // 呼び出し（関数）のパース
    function parseCallExpression(funcToken) {
      consume('Operator'); // '(' を消費
      const args = [];
      
      if (peek().value !== ')') {
        args.push(parseExpression());
        while (peek().value === ',') {
          consume('Operator');
          args.push(parseExpression());
        }
      }
      
      const closing = consume('Operator');
      if (closing.value !== ')') {
        throw new SyntaxError(`関数呼び出しの閉じカッコがありません (位置: ${closing.index})`);
      }
      
      return { type: 'CallExpression', callee: funcToken.value.toUpperCase(), arguments: args };
    }

    // 最優先要素 (Primary) の分解・リファクタリング
    function parsePrimary() {
      const token = peek();

      switch (token.type) {
        case 'String':
        case 'Number':
        case 'Boolean':
          consume(token.type);
          return { type: 'Literal', value: token.value };

        case 'Reference':
          consume('Reference');
          return { type: 'Reference', raw: token.value };

        case 'FunctionName':
          consume('FunctionName');
          return parseCallExpression(token);

        case 'Operator':
          if (token.value === '{') {
            return parseArrayLiteral();
          }
          if (token.value === '(') {
            consume('Operator');
            const expr = parseExpression();
            const closing = consume('Operator');
            if (closing.value !== ')') {
              throw new SyntaxError(`閉じカッコがありません (位置: ${closing.index})`);
            }
            return expr;
          }
          break;
      }

      throw new SyntaxError(`パースエラー: 予期しないトークン "${token.value}" (位置: ${token.index})`);
    }

    // 単項演算子 (Unary Minus / Plus) のパース
    function parseUnaryExpression() {
      const token = peek();
      if (token.type === 'Operator' && (token.value === '-' || token.value === '+')) {
        const opToken = consume('Operator');
        const argument = parseUnaryExpression(); // 再帰的にパース (- -5 などの結合に対応)
        return {
          type: 'UnaryExpression',
          operator: opToken.value,
          argument: argument
        };
      }
      return parsePrimary();
    }

    // 二項演算子の優先順位定義 (^ を追加)
    const PRECEDENCE = { 
      '=': 1, '<>': 1, '<': 1, '<=': 1, '>': 1, '>=': 1,
      '&': 2, 
      '+': 3, '-': 3, 
      '*': 4, '/': 4,
      '^': 5
    };

    function parseBinaryExpression(parentPrecedence) {
      let left = parseUnaryExpression();

      while (true) {
        const token = peek();
        if (token.type !== 'Operator' || !PRECEDENCE[token.value]) {
          break;
        }

        const precedence = PRECEDENCE[token.value];
        
        // '^' は右結合 (Right-associative) に対応
        const isRightAssociative = token.value === '^';
        if (isRightAssociative ? precedence < parentPrecedence : precedence <= parentPrecedence) {
          break;
        }

        const opToken = consume('Operator');
        const right = parseBinaryExpression(precedence);
        left = { type: 'BinaryExpression', operator: opToken.value, left: left, right: right };
      }

      return left;
    }

    function parseExpression() {
      return parseBinaryExpression(0);
    }

    const ast = parseExpression();
    const endToken = peek();
    if (endToken.type !== 'EOF') {
      throw new SyntaxError(`数式のパース完了前に終端に達しませんでした (位置: ${endToken.index}, トークン: "${endToken.value}")`);
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
    this.type = options.type;
    this.sheetNo = options.sheetNo;
    this.start = options.start;
    this.end = options.end || options.start;
  }

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
  
  static extractDependencies(astNode) {
    const deps = [];
    if (!astNode) return deps;

    const traverse = (node) => {
      if (!node) return;
      if (node.type === 'Reference') {
        deps.push(node.raw);
      } else if (node.type === 'UnaryExpression') {
        traverse(node.argument);
      } else if (node.type === 'BinaryExpression') {
        traverse(node.left);
        traverse(node.right);
      } else if (node.type === 'CallExpression') {
        for (const arg of node.arguments) traverse(arg);
      } else if (node.type === 'ArrayLiteral') {
        for (const row of node.matrix) {
          for (const cell of row) traverse(cell);
        }
      }
    };

    traverse(astNode);
    return deps;
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
    const sheets = {};
    const iterableBook = ((typeof book === 'object') && (typeof book[Symbol.iterator] !== 'function'))
      ? Array.from(Object.entries(book), entry => { return { name: entry[0], data: entry[1], *[Symbol.iterator]() { return yield* this.data; } }; })
      : book;
    const formulaQueue = [];

    const values = Array.from(iterableBook, (sheet, sheetNo) => {
      sheets[sheet.name] = sheetNo;
      return Array.from(sheet.data || sheet, (row, rowNo) =>
        Array.from(row, (cell, columnNo) => {
          if (cell instanceof FormulaAST) {
            formulaQueue.push({ sheetNo, rowNo, columnNo, formula: cell.ast });
            return this.constructor.Pending;
          }
          return cell;
        })
      );
    });

    const spillMap = new Map();
    const sortedQueue = this.buildExecutionOrder(formulaQueue, sheets);

    const setValue = (ctx, value) => {
      const { sheetNo, rowNo, columnNo } = ctx;
      if (!Array.isArray(value)) {
        values[sheetNo][rowNo][columnNo] = value;
        return;
      }

      for (let r = 0; r < value.length; r++) {
        for (let c = 0; c < value[r].length; c++) {
          const targetR = rowNo + r;
          const targetC = columnNo + c;
          
          if (values[sheetNo][targetR] && values[sheetNo][targetR][targetC] !== undefined) {
            values[sheetNo][targetR][targetC] = value[r][c];
          }

          spillMap.set(`${sheetNo}:${targetR}:${targetC}`, {
            originRow: rowNo,
            originCol: columnNo,
            offsetR: r,
            offsetC: c
          });
        }
      }
    };

    for (const ctx of sortedQueue) {
      const value = await this.calc(ctx, values, sheets);
      setValue(ctx, value);
    }

    if (iterableBook != book) {
      return Object.fromEntries(Array.from(Object.entries(sheets), entry => [entry[0], values[entry[1]]]));
    }

    return values;
  }

  calc(ctx, values, sheets) {
    const Pending = this.constructor.Pending;

    // 数値への安全なキャスト用ヘルパー
    const toNumber = (val) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val ? 1 : 0;
      const num = Number(val);
      if (isNaN(num)) throw new Error(`数値に変換できない値です: "${val}"`);
      return num;
    };

    // セル参照文字列 ("$A$1" や "A1") から行列番号を抽出 ($を排除)
    const parseSingleCell = (str) => {
      const cleanStr = str.replace(/\$/g, '');
      const match = cleanStr.match(/^([A-Za-z]+)([0-9]+)$/);
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

    const resolveValue = (val) => {
      if (val instanceof BookReference) {
        return val.getValue(values, Pending);
      }
      return val;
    };

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

        case 'UnaryExpression': {
          const argVal = resolveValue(evaluate(node.argument));
          if (argVal === Pending) return Pending;

          const num = toNumber(argVal);
          return node.operator === '-' ? -num : num;
        }

        case 'BinaryExpression': {
          let leftVal = resolveValue(evaluate(node.left));
          if (leftVal === Pending) return Pending;

          let rightVal = resolveValue(evaluate(node.right));
          if (rightVal === Pending) return Pending;

          switch (node.operator) {
            case '&': return `${leftVal}${rightVal}`;
            case '+': return toNumber(leftVal) + toNumber(rightVal);
            case '-': return toNumber(leftVal) - toNumber(rightVal);
            case '*': return toNumber(leftVal) * toNumber(rightVal);
            case '/': {
              const rightNum = toNumber(rightVal);
              if (rightNum === 0) throw new Error("0での除算が発生しました");
              return toNumber(leftVal) / rightNum;
            }
            case '^': return Math.pow(toNumber(leftVal), toNumber(rightVal));
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
            return funcObj.fn.apply({ Pending, context }, node.arguments);
          } else {
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

  buildExecutionOrder(formulaNodes, sheets) {
    const toKey = (s, r, c) => `${s}:${r}:${c}`;
    const nodeMap = new Map();

    for (const ctx of formulaNodes) {
      const key = toKey(ctx.sheetNo, ctx.rowNo, ctx.columnNo);
      nodeMap.set(key, ctx);
    }

    const adj = new Map();
    
    for (const [key, ctx] of nodeMap.entries()) {
      adj.set(key, []);
      const rawDeps = this.constructor.extractDependencies(ctx.formula);
      
      for (const depStr of rawDeps) {
        const resolvedCells = this.resolveReferenceToCells(depStr, ctx.sheetNo, sheets);
        for (const targetKey of resolvedCells) {
          if (nodeMap.has(targetKey)) {
            adj.get(key).push(targetKey);
          }
        }
      }
    }

    const visited = new Map();
    const sortedList = [];

    const dfs = (key) => {
      visited.set(key, 1);

      for (const neighbor of (adj.get(key) || [])) {
        const state = visited.get(neighbor) || 0;
        if (state === 1) {
          throw new Error(`循環参照が検出されました: セル [${key}] と [${neighbor}] の間でループしています。`);
        }
        if (state === 0) {
          dfs(neighbor);
        }
      }

      visited.set(key, 2);
      sortedList.push(nodeMap.get(key));
    };

    for (const key of nodeMap.keys()) {
      if ((visited.get(key) || 0) === 0) {
        dfs(key);
      }
    }

    return sortedList;
  }

  resolveReferenceToCells(refStr, currentSheetNo, sheets) {
    let sheetNo = currentSheetNo;
    let cellStr = refStr;

    if (refStr.includes('!')) {
      const parts = refStr.split('!');
      let sheetName = parts[0].replace(/^'|'$/g, '');
      sheetNo = sheets[sheetName];
      cellStr = parts[1];
    }

    const parseSingle = (str) => {
      const cleanStr = str.replace(/\$/g, '');
      const match = cleanStr.match(/^([A-Za-z]+)([0-9]+)$/);
      let col = 0;
      for (let i = 0; i < match[1].length; i++) {
        col = col * 26 + (match[1].charCodeAt(i) - 64);
      }
      return { rowNo: parseInt(match[2], 10) - 1, columnNo: col - 1 };
    };

    const keys = [];
    if (cellStr.includes(':')) {
      const [start, end] = cellStr.split(':').map(parseSingle);
      for (let r = Math.min(start.rowNo, end.rowNo); r <= Math.max(start.rowNo, end.rowNo); r++) {
        for (let c = Math.min(start.columnNo, end.columnNo); c <= Math.max(start.columnNo, end.columnNo); c++) {
          keys.push(`${sheetNo}:${r}:${c}`);
        }
      }
    } else {
      const p = parseSingle(cellStr);
      keys.push(`${sheetNo}:${p.rowNo}:${p.columnNo}`);
    }
    return keys;
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
