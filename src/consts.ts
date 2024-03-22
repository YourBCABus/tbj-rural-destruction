const lettersToIndicies = (letters: string) => {
    const base = "A".charCodeAt(0) - 1;
    let total = 0;
    for (let i = 0; i < letters.length; i++) {
        total *= 26;
        total += (letters.toUpperCase().charCodeAt(i) - base);
    }
    return total - 1;
}

const matchRegex = /^([A-Z]+)(\d*)$/;

export const parseCell = (cell: string, defaultRow: number) => {
    const [, col, optRow] = cell.toUpperCase().match(matchRegex) || [];
    const row = optRow ? parseInt(optRow) - 1 : defaultRow;
    return {
        col: lettersToIndicies(col),
        row,
    };
}

export const parseDataRange = (range: string) => {
    const [start, end] = range.toUpperCase().split(":");
    const { col: startCol, row: startRow } = parseCell(start, 0);
    const { col: endCol, row: endRow } = parseCell(end, 1000);

    return {
        startCol,
        startRow,
        endCol,
        endRow,
    };
}

export const CLEARABLE_DATA_RANGE = "G3:V";
export const REPORT_TO_CELL = "E3";
