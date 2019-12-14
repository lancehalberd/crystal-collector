
module.exports = {
    createSuspendedState,
    applySuspendedState,
}

const { COLUMN_WIDTH, ROW_HEIGHT, SHORT_EDGE, EDGE_LENGTH, canvas } = require('gameConstants');
const { 
    createCell, createCellsInRange, 
    getDepth, getRangeAtDepth,
    revealCellNumbers 
} = require('digging');

function createSuspendedState(state) {
    const explored = [];
    const revealed = [];
    for (let row = 0; row < state.rows.length; row++) {
        explored[row] = [];
        revealed[row] = [];
        const rowArray = state.rows[row] || [];
        for (let columnz = 0; columnz < rowArray.length; columnz++) {
            const cell = rowArray[columnz];
            if (!cell) {
                continue;
            }
            if (cell.explored) {
                explored[row].push(columnz);
            }
            if (cell.numbersRevealed) {
                revealed[row].push(columnz);
            }
        }
        explored[row] = compressRow(explored[row]);
        revealed[row] = compressRow(revealed[row]);
    }
    return {
        explored,
        revealed,
        row: state.robot.row,
        column: state.robot.column,
    }
}
window.createSuspendedState = createSuspendedState;

function compressRow(row) {
    // This inverts z(column)
    // (c >= 0) ? 2 * c : -2 * c - 1;
    //console.log(':' + row);
    row = row.map(z => (z % 2) ? -(z + 1) / 2 : z / 2);
    row.sort((a, b) => a - b);
    //console.log('->' + row);
    const compressedRow = [];
    let lastN;
    for (const N of row) {
        if (Array.isArray(lastN) && lastN[1] + 1 === N) {
            lastN[1]++;
        } else if (lastN + 1 === N) {
            compressedRow.pop();
            lastN = [lastN, N];
            compressedRow.push(lastN);
        } else {
            compressedRow.push(N);
            lastN = N;
        }
    }
    //console.log('-> ' + compressedRow);
    return compressedRow;
}
function uncompressRow(row) {
    //console.log('compressed', row);
    row = row.reduce((fullRow, e) => {
        if (Array.isArray(e)) {
            for (let i = e[0]; i <= e[1]; i++) {
                fullRow.push(i);
            }
        } else {
            fullRow.push(e);
        }
        return fullRow;
    }, []);
    //console.log('-> uncompressed', row);
    return row;
}

function applySuspendedState(state, suspendedState) {
    state = {
        ...state,
        rows: [],
        robot: {
            row: suspendedState.row, column: suspendedState.column,
            teleportingIn: false, animationTime: state.time
        }
    };
    for (let row = 0; row < suspendedState.explored.length; row++) {
        const rowArray = uncompressRow(suspendedState.explored[row] || []);
        for (let i = 0; i < rowArray.length; i++) {
            const column = rowArray[i];
            state = createCell(state, row, column);
            //console.log('exploring ' + row +' ' + column);
            const range = Math.round(getRangeAtDepth(state, getDepth(state, row, column)));
            state = createCellsInRange(state, row, column, false, range);
            const columnz = (column >= 0) ? 2 * column : -2 * column - 1;
            state.rows[row][columnz].explored = true;
        }
    }
    for (let row = 0; row < suspendedState.revealed.length; row++) {
        const rowArray = uncompressRow(suspendedState.revealed[row] || []);
        for (let i = 0; i < rowArray.length; i++) {
            const column = rowArray[i];
            state = revealCellNumbers(state, row, column);
            // Cells revealed at the edge of your normal range create all cells in a
            // radius of 1, some of which are outside your normal range.
            state = createCellsInRange(state, row, column, false, 1);
        }
    }
    const row = suspendedState.row, column = suspendedState.column;
    const left = column * COLUMN_WIDTH + SHORT_EDGE + EDGE_LENGTH / 2 - canvas.width / 2;
    const rowOffset = (column % 2) ? ROW_HEIGHT / 2 : 0;
    const top = Math.max(-200, (row + 0.5) * ROW_HEIGHT + rowOffset - canvas.height / 2);
    state = {...state, camera: {...state.camera, top, left}};

    return state;
}