(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BookFunctions = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';

// 内部ヘルパー: Excel風の条件式（例: ">10", "A*", "<>B"）を評価する
function matchCriterion(value, criterion) {
  if (criterion === undefined || criterion === null) return value === '';
  const cStr = String(criterion).trim();
  if (cStr === '') return value === '';

  // 比較演算子のパース
  const match = cStr.match(/^(=|<>|<=|>=|<|>)?(.*)$/);
  const op = match[1] || '=';
  const cVal = match[2];

  // 条件側が数値に変換可能なら数値比較、不可能なら文字列比較
  const isNumC = !isNaN(Number(cVal)) && cVal !== '';
  const isNumV = !isNaN(Number(value)) && value !== '' && typeof value !== 'boolean';

  if (op === '=') {
    if (isNumC && isNumV) return Number(value) === Number(cVal);
    // ワイルドカードの処理 (*, ?)
    const regexStr = '^' + cStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, m => (m === '*' ? '.*' : m === '?' ? '.' : '\\' + m)) + '$';
    return new RegExp(regexStr, 'i').test(String(value));
  }
  if (op === '<>') {
    if (isNumC && isNumV) return Number(value) !== Number(cVal);
    return String(value).toLowerCase() !== cVal.toLowerCase();
  }

  const v = isNumV ? Number(value) : String(value);
  const c = isNumC ? Number(cVal) : String(cVal);

  switch (op) {
    case '<': return v < c;
    case '<=': return v <= c;
    case '>': return v > c;
    case '>=': return v >= c;
    default: return false;
  }
}

// 内部ヘルパー: 階乗計算
function factorial(n) {
  if (n < 0) throw new Error("#NUM!");
  let res = 1;
  for (let i = 2; i <= Math.floor(n); i++) res *= i;
  return res;
}

const BookFunctions = {
  // 数学
  ABS: (v) => Math.abs(Number(v)),
  ACOS: (v) => Math.acos(Number(v)),
  ACOSH: (v) => Math.acosh(Number(v)),
  ACOT: (v) => Math.atan(1 / Number(v)),
  ACOTH: (v) => {
    const n = Number(v);
    if (n >= -1 && n <= 1) throw new Error("#NUM!");
    return 0.5 * Math.log((n + 1) / (n - 1));
  },
  ASIN: (v) => Math.asin(Number(v)),
  ASINH: (v) => Math.asinh(Number(v)),
  ATAN: (v) => Math.atan(v),
  ATAN2: (x, y) => Math.atan2(Number(y), Number(x)),
  ATANH: (v) => Math.atanh(Number(v)),
  COS: (v) => Math.cos(Number(v)),
  COSH: (v) => Math.cosh(Number(v)),
  COT: (v) => {
    const t = Math.tan(Number(v));
    if (t === 0) throw new Error("#DIV/0!");
    return 1 / t;
  },
  COTH: (v) => {
    const t = Math.tanh(Number(v));
    if (t === 0) throw new Error("#DIV/0!");
    return 1 / t;
  },
  CSC: (v) => {
    const s = Math.sin(Number(v));
    if (s === 0) throw new Error("#DIV/0!");
    return 1 / s;
  },
  CSCH: (v) => {
    const s = Math.sinh(Number(v));
    if (s === 0) throw new Error("#DIV/0!");
    return 1 / s;
  },
  SEC: (v) => {
    const c = Math.cos(Number(v));
    if (c === 0) throw new Error("#DIV/0!");
    return 1 / c;
  },
  SECH: (v) => {
    const c = Math.cosh(Number(v));
    if (c === 0) throw new Error("#DIV/0!");
    return 1 / c;
  },
  SIN: (v) => Math.sin(Number(v)),
  SINH: (v) => Math.sinh(Number(v)),
  TAN: (v) => Math.tan(Number(v)),
  TANH: (v) => Math.tanh(Number(v)),
  PI: () => Math.PI,
  DEGREES: (v) => Number(v) * (180 / Math.PI),
  RADIANS: (v) => Number(v) * (Math.PI / 180),
  EXP: (v) => Math.exp(Number(v)),
  LN: (v) => {
    if (Number(v) <= 0) throw new Error("#NUM!");
    return Math.log(Number(v));
  },
  LOG: (v, base = 10) => {
    if (Number(v) <= 0 || Number(base) <= 0 || Number(base) === 1) throw new Error("#NUM!");
    return Math.log(Number(v)) / Math.log(Number(base));
  },
  LOG10: (v) => {
    if (Number(v) <= 0) throw new Error("#NUM!");
    return Math.log10(Number(v));
  },
  SQRT: (v) => {
    if (Number(v) < 0) throw new Error("#NUM!");
    return Math.sqrt(Number(v));
  },
  SQRTPI: (v) => {
    if (Number(v) < 0) throw new Error("#NUM!");
    return Math.sqrt(Number(v) * Math.PI);
  },
  SIGN: (v) => Math.sign(Number(v)),
  BASE(value, base, min_length) {
    const v = Math.floor(Number(value));
    const b = Math.floor(Number(base));
    if (v < 0 || b < 2 || b > 36) throw new Error("#NUM!");
    let res = v.toString(b).toUpperCase();
    if (min_length) {
      res = res.padStart(Math.floor(Number(min_length)), '0');
    }
    return res;
  },
  DECIMAL(value, base) {
    const b = Math.floor(Number(base));
    if (b < 2 || b > 36) throw new Error("#NUM!");
    const res = parseInt(String(value), b);
    if (isNaN(res)) throw new Error("#NUM!");
    return res;
  },
  CEILING(v, factor = 1) {
    if (Number(factor) === 0) return 0;
    return Math.ceil(Number(v) / Number(factor)) * Number(factor);
  },
  "CEILING.MATH"(number, significance = 1, mode = 0) {
    const n = Number(number);
    const s = Number(significance);
    if (s === 0) return 0;
    if (n >= 0 || mode !== 0) {
      return Math.ceil(n / s) * s;
    } else {
      return Math.floor(n / s) * s;
    }
  },
  "CEILING.PRECISE"(number, significance = 1) {
    const s = Math.abs(Number(significance));
    if (s === 0) return 0;
    return Math.ceil(Number(number) / s) * s;
  },
  "ISO.CEILING"(number, significance = 1) {
    return BookMathFunctions["CEILING.PRECISE"](number, significance);
  },
  FLOOR(v, factor = 1) {
    if (Number(factor) === 0) throw new Error("#DIV/0!");
    return Math.floor(Number(v) / Number(factor)) * Number(factor);
  },
  "FLOOR.MATH"(number, significance = 1, mode = 0) {
    const n = Number(number);
    const s = Number(significance);
    if (s === 0) return 0;
    if (n >= 0 || mode !== 0) {
      return Math.floor(n / s) * s;
    } else {
      return Math.ceil(n / s) * s; // 負の数でmode=0なら0に近づく方向
    }
  },
  "FLOOR.PRECISE"(number, significance = 1) {
    const s = Math.abs(Number(significance));
    if (s === 0) return 0;
    return Math.floor(Number(number) / s) * s;
  },
  INT: (v) => Math.floor(Number(v)),
  EVEN(v) {
    const n = Number(v);
    const sign = Math.sign(n);
    let abs = Math.ceil(Math.abs(n));
    if (abs % 2 !== 0) abs += 1;
    return abs * (sign || 1);
  },
  ODD(v) {
    const n = Number(v);
    const sign = Math.sign(n);
    let abs = Math.ceil(Math.abs(n));
    if (abs % 2 === 0) abs += 1;
    return abs * (sign || 1);
  },
  MROUND(v, factor) {
    const f = Number(factor);
    if (f === 0) return 0;
    if (Math.sign(Number(v)) !== Math.sign(f)) throw new Error("#NUM!");
    return Math.round(Number(v) / f) * f;
  },
  ROUND(v, places = 0) {
    const p = Math.floor(Number(places));
    return Math.round(Number(v) * Math.pow(10, p)) / Math.pow(10, p);
  },
  ROUNDDOWN(v, places = 0) {
    const p = Math.floor(Number(places));
    const sign = Math.sign(Number(v));
    return (Math.floor(Math.abs(Number(v)) * Math.pow(10, p)) / Math.pow(10, p)) * sign;
  },
  ROUNDUP(v, places = 0) {
    const p = Math.floor(Number(places));
    const sign = Math.sign(Number(v));
    return (Math.ceil(Math.abs(Number(v)) * Math.pow(10, p)) / Math.pow(10, p)) * sign;
  },
  TRUNC(v, places = 0) {
    const p = Math.floor(Number(places));
    return (Number(v) > 0 ? Math.floor(Number(v) * Math.pow(10, p)) : Math.ceil(Number(v) * Math.pow(10, p))) / Math.pow(10, p);
  },
  COMBIN(n, k) {
    const num = Math.floor(Number(n));
    const pool = Math.floor(Number(k));
    if (num < 0 || pool < 0 || num < pool) throw new Error("#NUM!");
    return factorial(num) / (factorial(pool) * factorial(num - pool));
  },
  COMBINA(n, k) {
    const num = Math.floor(Number(n));
    const pool = Math.floor(Number(k));
    if (num < 0 || pool < 0 || (num === 0 && pool > 0)) throw new Error("#NUM!");
    if (num === 0 && pool === 0) return 1;
    return BookMathFunctions.COMBIN(num + pool - 1, pool);
  },
  FACT: (v) => factorial(Number(v)),
  FACTDOUBLE(v) {
    const n = Math.floor(Number(v));
    if (n < -1) throw new Error("#NUM!");
    if (n === -1 || n === 0) return 1;
    let res = 1;
    for (let i = n; i > 0; i -= 2) res *= i;
    return res;
  },
  GCD(...args) {
    const arr = args.flat(Infinity).map(v => Math.floor(Math.abs(Number(v))));
    const gcdPair = (a, b) => (b === 0 ? a : gcdPair(b, a % b));
    return arr.reduce((acc, val) => gcdPair(acc, val), arr[0] || 0);
  },
  LCM(...args) {
    const arr = args.flat(Infinity).map(v => Math.floor(Math.abs(Number(v))));
    const gcdPair = (a, b) => (b === 0 ? a : gcdPair(b, a % b));
    const lcmPair = (a, b) => (a === 0 || b === 0 ? 0 : (a * b) / gcdPair(a, b));
    return arr.reduce((acc, val) => lcmPair(acc, val), arr[0] || 0);
  },
  MULTINOMIAL(...args) {
    const arr = args.flat(Infinity).map(v => Math.floor(Number(v)));
    const sum = arr.reduce((acc, val) => acc + val, 0);
    const denom = arr.reduce((acc, val) => acc * factorial(val), 1);
    return factorial(sum) / denom;
  },
  MUNIT(dim) {
    const d = Math.floor(Number(dim));
    if (d <= 0) throw new Error("#VALUE!");
    const matrix = [];
    for (let r = 0; r < d; r++) {
      const row = [];
      for (let c = 0; c < d; c++) row.push(r === c ? 1 : 0);
      matrix.push(row);
    }
    return matrix;
  },
  RAND: () => Math.random(),
  RANDARRAY(rows = 1, columns = 1) {
    const r = Math.floor(Number(rows));
    const c = Math.floor(Number(columns));
    if (r <= 0 || c <= 0) throw new Error("#VALUE!");
    const matrix = [];
    for (let i = 0; i < r; i++) {
      const row = [];
      for (let j = 0; j < c; j++) row.push(Math.random());
      matrix.push(row);
    }
    return matrix;
  },
  RANDBETWEEN(low, high) {
    const l = Math.ceil(Number(low));
    const h = Math.floor(Number(high));
    if (l > h) throw new Error("#NUM!");
    return Math.floor(Math.random() * (h - l + 1)) + l;
  },
  SEQUENCE(rows = 1, columns = 1, start = 1, step = 1) {
    const r = Math.floor(Number(rows));
    const c = Math.floor(Number(columns));
    let val = Number(start);
    const s = Number(step);
    const matrix = [];
    for (let i = 0; i < r; i++) {
      const row = [];
      for (let j = 0; j < c; j++) {
        row.push(val);
        val += s;
      }
      matrix.push(row);
    }
    return matrix;
  },
  SERIESSUM(x, n, m, a) {
    const flatA = Array.isArray(a) ? a.flat(Infinity).map(Number) : [Number(a)];
    const xv = Number(x);
    let curPower = Number(n);
    const mv = Number(m);
    let sum = 0;
    for (let i = 0; i < flatA.length; i++) {
      sum += flatA[i] * Math.pow(xv, curPower);
      curPower += mv;
    }
    return sum;
  },
  GAMMALN: (v) => {
    const x = Number(v);
    if (x <= 0) throw new Error("#NUM!");
    const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let ser = 1.000000000190015;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    for (let j = 0; j <= 5; j++) ser += cof[j] / (x + j + 1);
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  },
  "GAMMALN.PRECISE": (v) => BookMathFunctions.GAMMALN(v),
  ISEVEN: (v) => Math.floor(Math.abs(Number(v))) % 2 === 0,
  ISODD: (v) => Math.floor(Math.abs(Number(v))) % 2 !== 0,
  ERFC(z) {
    const t = 1.0 / (1.0 + 0.5 * Math.abs(Number(z)));
    const ans = t * Math.exp(-Number(z) * Number(z) - 1.26551223 + t * (1.00002368 + t * (0.37383779 + t * (0.05995407 + t * (-0.01213230 + t * (0.00508547 + t * (0.00644358 + t * (-0.00568646 + t * 0.00394440))))))));
    return Number(z) >= 0 ? ans : 2.0 - ans;
  },
  "ERFC.PRECISE": (z) => BookMathFunctions.ERFC(z),
  IMLN(comp) {
    let r = 0, i = 0;
    if (Array.isArray(comp)) { r = comp[0]; i = comp[1]; }
    else { const m = String(comp).match(/^([+-]?\d*\.?\d+)?([+-]\d*\.?\d+)i$/); if (m) { r = Number(m[1] || 0); i = Number(m[2]); } else r = Number(comp); }
    return [Math.log(Math.sqrt(r * r + i * i)), Math.atan2(i, r)];
  },
  IMPOWER(comp, exp) {
    let r = 0, i = 0;
    if (Array.isArray(comp)) { r = comp[0]; i = comp[1]; }
    else { const m = String(comp).match(/^([+-]?\d*\.?\d+)?([+-]\d*\.?\d+)i$/); if (m) { r = Number(m[1] || 0); i = Number(m[2]); } else r = Number(comp); }
    const e = Number(exp);
    const abs = Math.pow(r * r + i * i, e / 2);
    const theta = Math.atan2(i, r) * e;
    return [abs * Math.cos(theta), abs * Math.sin(theta)];
  },
  IMSQRT(comp) {
    return BookMathFunctions.IMPOWER(comp, 0.5);
  },
  PRODUCT(...args) {
    const flat = args.flat(Infinity).map(Number).filter(v => !isNaN(v));
    if (flat.length === 0) return 0;
    return flat.reduce((acc, val) => acc * val, 1);
  },
  QUOTIENT(dividend, divisor) {
    const den = Math.floor(Number(divisor));
    if (den === 0) throw new Error("#DIV/0!");
    return Math.trunc(Math.floor(Number(dividend)) / den);
  },
  MOD(dividend, divisor) {
    const dn = Number(divisor);
    if (dn === 0) throw new Error("#DIV/0!");
    const dv = Number(dividend);
    return dv - dn * Math.floor(dv / dn);
  },
  SUM(...args) {
    return args.flat(Infinity).reduce((sum, val) => {
      const num = Number(val);
      return isNaN(num) ? sum : sum + num;
    }, 0);
  },
  SUMSQ(...args) {
    return args.flat(Infinity).reduce((sum, val) => {
      const num = Number(val);
      return isNaN(num) ? sum : sum + (num * num);
    }, 0);
  },
  COUNTBLANK(range) {
    if (!Array.isArray(range)) return range === '' || range === null ? 1 : 0;
    return range.flat(Infinity).filter(v => v === '' || v === null || v === undefined).length;
  },
  COUNTIF(range, criterion) {
    const flatRange = Array.isArray(range) ? range.flat(Infinity) : [range];
    return flatRange.filter(v => matchCriterion(v, criterion)).length;
  },
  COUNTIFS(...args) {
    if (args.length % 2 !== 0) throw new Error("#VALUE!");
    const ranges = [];
    const crits = [];
    for (let i = 0; i < args.length; i += 2) {
      ranges.push(Array.isArray(args[i]) ? args[i].flat(Infinity) : [args[i]]);
      crits.push(args[i + 1]);
    }
    const len = ranges[0].length;
    let count = 0;
    for (let i = 0; i < len; i++) {
      let match = true;
      for (let j = 0; j < ranges.length; j++) {
        if (!matchCriterion(ranges[j][i], crits[j])) { match = false; break; }
      }
      if (match) count++;
    }
    return count;
  },
  COUNTUNIQUE(...args) {
    const flat = args.flat(Infinity).filter(v => v !== null && v !== undefined && v !== '');
    return new Set(flat).size;
  },
  SUMIF(range, criterion, sum_range) {
    const flatRange = Array.isArray(range) ? range.flat(Infinity) : [range];
    const targetRange = sum_range ? (Array.isArray(sum_range) ? sum_range.flat(Infinity) : [sum_range]) : flatRange;
    let sum = 0;
    for (let i = 0; i < flatRange.length; i++) {
      if (matchCriterion(flatRange[i], criterion)) {
        const num = Number(targetRange[i]);
        if (!isNaN(num)) sum += num;
      }
    }
    return sum;
  },
  SUMIFS(sum_range, ...args) {
    if (args.length % 2 !== 0) throw new Error("#VALUE!");
    const flatSum = Array.isArray(sum_range) ? sum_range.flat(Infinity) : [sum_range];
    const ranges = [];
    const crits = [];
    for (let i = 0; i < args.length; i += 2) {
      ranges.push(Array.isArray(args[i]) ? args[i].flat(Infinity) : [args[i]]);
      crits.push(args[i + 1]);
    }
    let sum = 0;
    for (let i = 0; i < flatSum.length; i++) {
      let match = true;
      for (let j = 0; j < ranges.length; j++) {
        if (!matchCriterion(ranges[j][i], crits[j])) { match = false; break; }
      }
      if (match) {
        const num = Number(flatSum[i]);
        if (!isNaN(num)) sum += num;
      }
    }
    return sum;
  },
  SUBTOTAL(function_code, ...args) {
    const code = Math.floor(Number(function_code));
    const flatArgs = args.flat(Infinity);
    switch (code % 100) {
      case 1: // AVERAGE
        const nums = flatArgs.map(Number).filter(v => !isNaN(v));
        return nums.reduce((a, b) => a + b, 0) / nums.length;
      case 2: // COUNT
        return flatArgs.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && v !== '')).length;
      case 3: // COUNTA
        return flatArgs.filter(v => v !== '').length;
      case 4: // MAX
        return Math.max(...flatArgs.map(Number).filter(v => !isNaN(v)));
      case 5: // MIN
        return Math.min(...flatArgs.map(Number).filter(v => !isNaN(v)));
      case 6: // PRODUCT
        return BookMathFunctions.PRODUCT(flatArgs);
      case 9: // SUM
        return BookMathFunctions.SUM(flatArgs);
      case 11: // VAR
        // 簡易実装
        const s = BookMathFunctions.SUM(flatArgs);
        const avg = s / flatArgs.length;
        return flatArgs.reduce((acc, v) => acc + Math.pow(Number(v) - avg, 2), 0) / (flatArgs.length - 1);
      default:
        throw new Error("#VALUE!");
    }
  },
  
  // 統計
  // 平均値
  AVERAGE(...args) {
    const flatArgs = args.flat(Infinity).map(Number).filter(val => !isNaN(val));
    if (flatArgs.length === 0) return 0;
    const sum = flatArgs.reduce((acc, val) => acc + val, 0);
    return sum / flatArgs.length;
  },
  // 数値の個数
  COUNT(...args) {
    return args.flat(Infinity).filter(val => {
      if (typeof val === 'string' && val.trim() === '') return false;
      return !isNaN(Number(val)) && val !== null && val !== '';
    }).length;
  },
  
  // 参照
  // 垂直検索 (範囲はBookEngineから二次元配列として渡されます)
  VLOOKUP(searchChar, matrix, colIndex, exactMatch = true) {
    if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0])) {
      throw new Error("#VALUE!: 範囲指定が正しくありません");
    }
    for (const row of matrix) {
      const key = row[0];
      if (String(key) === String(searchChar)) {
        return row[colIndex - 1] !== undefined ? row[colIndex - 1] : 0;
      }
    }
    throw new Error(`#N/A: 値が見つかりません (${searchChar})`);
  },
  // 行番号の取得
  ROW(...args) {
    if (args.length === 0) {
      return this.context.caller.rowNo + 1;
    }
    const ref = this.context.arguments[0];
    if (ref && (ref.type === 'cell' || ref.type === 'range')) {
      const start = ref.type === 'range' ? ref.start : ref;
      return start.rowNo + 1;
    }
    return this.context.caller.rowNo + 1;
  },
  // 列番号の取得
  COLUMN(...args) {
    if (args.length === 0) {
      return this.context.caller.columnNo + 1;
    }
    const ref = this.context.arguments[0];
    if (ref && (ref.type === 'cell' || ref.type === 'range')) {
      const start = ref.type === 'range' ? ref.start : ref;
      return start.columnNo + 1;
    }
    return this.context.caller.columnNo + 1;
  },
  
  // 論理
  // 論理式が TRUE の場合はある値を返し、FALSE の場合は別の値を返します。
  "!IF"(condNode, trueNode, falseNode) {
    const condition = this.context.evaluate(condNode);

    if (condition === this.Pending) {
      return this.Pending; // 依存セルがPendingの場合
    }

    if (condition) {
      return this.context.evaluate(trueNode);
    } else {
      return falseNode ? this.context.evaluate(falseNode) : 0;
    }
  }
};

return BookFunctions;
}));