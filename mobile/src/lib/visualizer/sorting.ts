import { at, indices, type M } from "./arrays";
import type { ArrayGen, Step } from "./types";

const result = (f: Step[], a: number[]): ArrayGen => ({ kind: "array", frames: f, result: a.join(", ") });

export function bubbleSort(input: number[]): ArrayGen {
  const a = [...input];
  const n = a.length;
  const sortedFrom = (k: number) => indices(n).filter((i) => i >= k);
  const f: Step[] = [at(a, 0, n ? "Start: nothing is in its final place yet." : "The array is empty, so there is nothing to sort.")];
  for (let end = n - 1; end > 0; end--) {
    f.push(at(a, 0, `Pass: carry the largest unsorted value to index ${end}.`, [], { dim: sortedFrom(end + 1) }));
    for (let i = 0; i < end; i++) {
      const x = a[i];
      const y = a[i + 1];
      if (x > y) {
        a[i] = y;
        a[i + 1] = x;
        f.push(at(a, 2, `${x} > ${y}, so swap them. ${x} moves right.`, [[i, "swap"], [i + 1, "swap"]], { dim: sortedFrom(end + 1) }));
      } else {
        f.push(at(a, 2, `${x} <= ${y}, already in order. No swap.`, [[i, "cmp"], [i + 1, "cmp"]], { dim: sortedFrom(end + 1) }));
      }
    }
    f.push(at(a, 3, `${a[end]} is now at index ${end}, its final place.`, [[end, "done"]], { dim: sortedFrom(end) }));
  }
  f.push(at(a, 3, n ? "Sorted." : "Empty array, nothing to do."));
  return result(f, a);
}

export function selectionSort(input: number[]): ArrayGen {
  const a = [...input];
  const n = a.length;
  const sortedTo = (k: number) => indices(n).filter((i) => i < k);
  const f: Step[] = [at(a, 0, n ? "Start: the sorted part is empty." : "The array is empty, so there is nothing to sort.")];
  for (let i = 0; i < n - 1; i++) {
    let m = i;
    f.push(at(a, 1, `Assume a[${i}] = ${a[i]} is the smallest unsorted value. Call its index min.`, [[i, "i"], [m, "min"]], { dim: sortedTo(i) }));
    for (let j = i + 1; j < n; j++) {
      const old = a[m];
      const marks: M[] = [[i, "i"], [j, "j"], [m, "min"]];
      if (a[j] < old) {
        m = j;
        f.push(at(a, 3, `a[${j}] = ${a[j]} is smaller than ${old}, so min moves to index ${j}.`, marks, { dim: sortedTo(i) }));
      } else {
        f.push(at(a, 3, `a[${j}] = ${a[j]} is not smaller than ${old}. min stays at index ${m}.`, marks, { dim: sortedTo(i) }));
      }
    }
    if (m !== i) {
      [a[i], a[m]] = [a[m], a[i]];
      f.push(at(a, 4, `Swap a[${i}] and a[${m}]: the smallest value ${a[i]} is now at index ${i}.`, [[i, "swap"], [m, "swap"]], { dim: sortedTo(i + 1) }));
    } else {
      f.push(at(a, 4, `a[${i}] is already the smallest. No swap needed.`, [[i, "done"]], { dim: sortedTo(i + 1) }));
    }
  }
  f.push(at(a, 4, n ? "Sorted." : "Empty array, nothing to do."));
  return result(f, a);
}

export function insertionSort(input: number[]): ArrayGen {
  const a = [...input];
  const n = a.length;
  const f: Step[] = [at(a, 0, n ? "Treat a[0] as a sorted list of one value." : "The array is empty, so there is nothing to sort.")];
  for (let i = 1; i < n; i++) {
    const key = a[i];
    const structure = { label: "Key being inserted", items: [String(key)] };
    let j = i - 1;
    f.push(at(a, 1, `key = a[${i}] = ${key}. Everything left of index ${i} is sorted. Find where ${key} belongs.`, [[i, "i"]], { structure }));
    while (j >= 0 && a[j] > key) {
      f.push(at(a, 2, `a[${j}] = ${a[j]} is greater than ${key}, so shift it right.`, [[j, "cmp"]], { structure }));
      a[j + 1] = a[j];
      f.push(at(a, 3, `a[${j}] moved to index ${j + 1}. Index ${j} is free.`, [[j + 1, "moved"]], { structure }));
      j--;
    }
    if (j >= 0) f.push(at(a, 2, `a[${j}] = ${a[j]} is not greater than ${key}, so stop here.`, [[j, "cmp"]], { structure }));
    a[j + 1] = key;
    f.push(at(a, 4, `Place ${key} at index ${j + 1}. a[0..${i}] is sorted now.`, [[j + 1, "new"]]));
  }
  f.push(at(a, 4, n ? "Sorted." : "Empty array, nothing to do."));
  return result(f, a);
}

/** Top-down merge sort. Each merge shows the two heads being compared and the write-back. */
export function mergeSort(input: number[]): ArrayGen {
  const a = [...input];
  const n = a.length;
  const f: Step[] = [];
  const outside = (lo: number, hi: number) => indices(n).filter((k) => k < lo || k > hi);
  const rec = (lo: number, hi: number): void => {
    if (lo >= hi) {
      f.push(at(a, 1, `a[${lo}] alone is already sorted.`, [[lo, "done"]], { dim: outside(lo, hi) }));
      return;
    }
    const mid = (lo + hi) >> 1;
    f.push(at(a, 2, `Split a[${lo}..${hi}] at mid = ${mid}. Sort each half first.`, [], { dim: outside(lo, hi) }));
    rec(lo, mid);
    rec(mid + 1, hi);
    const left = a.slice(lo, mid + 1);
    const right = a.slice(mid + 1, hi + 1);
    const out: number[] = [];
    let p = 0;
    let q = 0;
    while (p < left.length && q < right.length) {
      const takeLeft = left[p] <= right[q];
      f.push(at(a, 4, `Compare the heads ${left[p]} (left) and ${right[q]} (right). Take ${takeLeft ? left[p] : right[q]}.`, [[lo + p, "L"], [mid + 1 + q, "R"]], { dim: outside(lo, hi) }));
      out.push(takeLeft ? left[p++] : right[q++]);
    }
    while (p < left.length) out.push(left[p++]);
    while (q < right.length) out.push(right[q++]);
    for (let k = 0; k < out.length; k++) a[lo + k] = out[k];
    f.push(at(a, 5, `Write the merged run ${out.join(", ")} back into a[${lo}..${hi}].`, [], { dim: outside(lo, hi) }));
  };
  if (n === 0) f.push(at(a, 0, "The array is empty, so there is nothing to sort."));
  else rec(0, n - 1);
  f.push(at(a, 5, n ? "Sorted." : "Empty array, nothing to do."));
  return result(f, a);
}

/** Quick sort with the Lomuto partition, using the last value as the pivot. */
export function quickSort(input: number[]): ArrayGen {
  const a = [...input];
  const n = a.length;
  const f: Step[] = [];
  const outside = (lo: number, hi: number) => indices(n).filter((k) => k < lo || k > hi);
  const partition = (lo: number, hi: number): number => {
    const pivot = a[hi];
    let i = lo;
    f.push(at(a, 5, `Pivot = a[${hi}] = ${pivot}. Values smaller than the pivot go to the left of i.`, [[hi, "pivot"], [i, "i"]], { dim: outside(lo, hi) }));
    for (let j = lo; j < hi; j++) {
      const x = a[j];
      if (x < pivot) {
        if (i !== j) [a[i], a[j]] = [a[j], a[i]];
        f.push(at(a, 7, `${x} < ${pivot}, so it joins the left part at index ${i}. i moves to ${i + 1}.`, [[i, "swap"], [j, "swap"], [hi, "pivot"]], { dim: outside(lo, hi) }));
        i++;
      } else {
        f.push(at(a, 7, `${x} >= ${pivot}, so it stays on the right side.`, [[j, "cmp"], [hi, "pivot"], [i, "i"]], { dim: outside(lo, hi) }));
      }
    }
    [a[i], a[hi]] = [a[hi], a[i]];
    f.push(at(a, 8, `Move the pivot to index ${i}. It is in its final place.`, [[i, "done"]], { dim: outside(lo, hi) }));
    return i;
  };
  const rec = (lo: number, hi: number): void => {
    if (lo >= hi) {
      if (lo === hi) f.push(at(a, 1, `a[${lo}] alone is in place.`, [[lo, "done"]], { dim: outside(lo, hi) }));
      return;
    }
    f.push(at(a, 2, `Partition a[${lo}..${hi}] around its last value.`, [], { dim: outside(lo, hi) }));
    const p = partition(lo, hi);
    rec(lo, p - 1);
    rec(p + 1, hi);
  };
  if (n === 0) f.push(at(a, 0, "The array is empty, so there is nothing to sort."));
  else rec(0, n - 1);
  f.push(at(a, 8, n ? "Sorted." : "Empty array, nothing to do."));
  return result(f, a);
}

/** Heap sort with a max-heap stored in the array itself. */
export function heapSort(input: number[]): ArrayGen {
  const a = [...input];
  const n = a.length;
  const f: Step[] = [];
  const sortedFrom = (k: number) => indices(n).filter((i) => i >= k);
  const sift = (start: number, size: number): void => {
    let root = start;
    f.push(at(a, 6, `Sift down from index ${root}. Its children are ${2 * root + 1} and ${2 * root + 2}, if they exist.`, [[root, "root"]], { dim: sortedFrom(size) }));
    let child = 2 * root + 1;
    while (child < size) {
      if (child + 1 < size) {
        const left = a[child];
        const right = a[child + 1];
        if (right > left) child = child + 1;
        f.push(at(a, 8, `Children ${left} and ${right}. The larger is ${a[child]} at index ${child}.`, [[root, "root"], [child, "cmp"]], { dim: sortedFrom(size) }));
      }
      const cv = a[child];
      const pv = a[root];
      if (cv > pv) {
        [a[root], a[child]] = [a[child], a[root]];
        f.push(at(a, 9, `${cv} is bigger than its parent ${pv}, so swap them and keep sifting down.`, [[root, "swap"], [child, "swap"]], { dim: sortedFrom(size) }));
        root = child;
        child = 2 * root + 1;
      } else {
        f.push(at(a, 10, `${cv} is not bigger than ${pv}, so the heap holds here. Stop.`, [[root, "root"], [child, "cmp"]], { dim: sortedFrom(size) }));
        return;
      }
    }
  };
  if (n === 0) f.push(at(a, 0, "The array is empty, so there is nothing to sort."));
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    f.push(at(a, 0, `Build a max-heap: sift down the node at index ${i}.`, [[i, "root"]]));
    sift(i, n);
  }
  for (let end = n - 1; end > 0; end--) {
    f.push(at(a, 3, `Move the maximum ${a[0]} to index ${end}, the end of the unsorted part.`, [[0, "cmp"], [end, "swap"]], { dim: sortedFrom(end + 1) }));
    [a[0], a[end]] = [a[end], a[0]];
    f.push(at(a, 4, `Index ${end} is final. Restore the heap on indices 0 to ${end - 1}.`, [[end, "done"]], { dim: sortedFrom(end) }));
    sift(0, end);
  }
  f.push(at(a, 2, n ? "Sorted." : "Empty array, nothing to do."));
  return result(f, a);
}
