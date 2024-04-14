export const uniqueCombinations = <T, V, U>(arr1: T[], arr2: V[], callbackfn: (x: T, y: V) => U): U[] => arr1.flatMap(d => arr2.map(v => callbackfn(d, v)));
export const zip = (...rows: any[][]) => rows?.[0].map((_, c) => rows.map(row => row[c])) ?? rows;
export const k_combinations = <T>(set: T[], k: number): T[][] => {
    let i: number, j: number, combs: T[][], head: T[], tailcombs: T[][];

    // There is no way to take e.g. sets of 5 elements from
    // a set of 4.
    if (k > set.length || k <= 0) {
        return [];
    }

    // K-sized set has only one K-sized subset.
    if (k == set.length) {
        return [set];
    }

    // There is N 1-sized subsets in a N-sized set.
    if (k == 1) {
        combs = [];
        for (i = 0; i < set.length; i++) {
            combs.push([set[i]]);
        }
        return combs;
    }
    combs = [];
    for (i = 0; i < set.length - k + 1; i++) {
        // head is a list that includes only our current element.
        head = set.slice(i, i + 1);
        // We take smaller combinations from the subsequent elements
        tailcombs = k_combinations(set.slice(i + 1), k - 1);
        // For each (k-1)-combination we join it with the current
        // and store it to the set of k-combinations.
        for (j = 0; j < tailcombs.length; j++) {
            combs.push(head.concat(tailcombs[j]));
        }
    }
    return combs;
};
export const combinations = <T>(set: T[]): T[][] => {
    let k: number, i: number, combs: T[][], k_combs: T[][];
    combs = [];

    // Calculate all non-empty k-combinations
    for (k = 1; k <= set.length; k++) {
        k_combs = k_combinations(set, k);
        for (i = 0; i < k_combs.length; i++) {
            combs.push(k_combs[i]);
        }
    }
    return combs;
};
export const groupBy = <T, V extends object | {}>(arr: T[], fn: (element: T) => V): T[][] => {
    return Object.values(
        arr.reduce((acc, cur) => {
            const result = fn(cur);
            let key: string;
            if (typeof result == 'object') {
                const obj = Array.isArray(result) ? result.map(x => ['', x]) : Object.entries(result);
                key = JSON.stringify(obj.toSorted(([, a], [, b]) => a > b ? 1 : a < b ? -1 : 0));
            }
            else {
                key = JSON.stringify(result);
            }
            if (key in acc) {
                acc[key].push(cur);
            }
            else {
                acc[key] = [cur];
            }

            return acc;
        }, {} as Record<string, T[]>)
    );
};