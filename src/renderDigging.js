const {
    WIDTH,
    HEIGHT,
    EDGE_LENGTH,
    SHORT_EDGE,
    LONG_EDGE,
    COLUMN_WIDTH,
    ROW_HEIGHT,
} = require('gameConstants');

// const Rectangle = require('Rectangle');
const { drawText } = require('draw');

const { z, canExploreCell, getFuelCost, isCellRevealed, getFlagValue } = require('digging');

function renderDigging(context, state) {
    if (state.camera.top < 500) {
        let gradient = context.createLinearGradient(0, 200 - state.camera.top, 0, 500 - state.camera.top);
        gradient.addColorStop(0, "#840");
        gradient.addColorStop(1, "black");
        context.fillStyle = gradient;
    } else {
        context.fillStyle = 'black';
    }
    context.fillRect(0, 0, WIDTH, HEIGHT);
    if (state.camera.top < LONG_EDGE) {
        context.fillStyle = '#08F';
        context.fillRect(0, 0, WIDTH, LONG_EDGE - state.camera.top);
    }

    const topRow = Math.max(0, Math.floor(state.camera.top / ROW_HEIGHT - 1));
    const rows = Math.ceil(HEIGHT / ROW_HEIGHT) + 2;
    const leftColumn = Math.floor(state.camera.left / COLUMN_WIDTH) - 1;
    const columns = Math.ceil(WIDTH / COLUMN_WIDTH) + 2;

    for (let row = topRow; row < topRow + rows; row++) {
        for (let column = leftColumn; column < leftColumn + columns; column++) {
            renderCell(context,state, row, column, state.camera.top, state.camera.left);
        }
    }
    if (state.overButton && state.overButton.cell) {
        let {row, column} = state.overButton;
        context.lineWidth = 2;
        if (isCellRevealed(state, row, column)) {
            context.strokeStyle = '#EEE';
        } else if (canExploreCell(state, row, column)) {
            const fuelCost = getFuelCost(state, row, column);
            const isFlagged = getFlagValue(state, row, column);
            context.strokeStyle = (fuelCost <= state.fuel  && isFlagged !== 2) ? '#0F0' : 'red';
        } else {
            context.strokeStyle = 'red';
        }
        drawCellPath(context, state, row, column);
        context.stroke();
    }
    context.save();
    // Draw lava.
    const lavaDepthY = state.displayLavaDepth * ROW_HEIGHT / 2 + ROW_HEIGHT / 2 - state.camera.top;
    const waveHeight = ROW_HEIGHT / 3;
    if (lavaDepthY < HEIGHT + 200) {
        let gradient = context.createLinearGradient(0, lavaDepthY - 150, 0, lavaDepthY + ROW_HEIGHT / 2);
        gradient.addColorStop(0.05 + Math.sin(state.time / 500) * 0.05, "rgba(255, 255, 0, 0.0)");
        gradient.addColorStop(.90, "rgba(255, 255, 0, 0.8)");
        context.fillStyle = gradient;
        context.fillRect(0, lavaDepthY + waveHeight - 200, WIDTH, HEIGHT);
    }
    if (lavaDepthY < HEIGHT + ROW_HEIGHT / 2) {
        context.globalAlpha = 0.8;
        context.fillStyle = 'red';
        context.beginPath();
        const numPoints = 30;
        context.moveTo(0, HEIGHT);
        for (let i = 0; i <= numPoints; i++) {
            const x = WIDTH * i / numPoints;
            const y = lavaDepthY - 7
                + waveHeight * Math.sin((x + state.time) / 100) / 20
                + waveHeight * Math.sin((x + state.time) / 200) / 10
                + waveHeight * Math.sin((x + state.time) / 500) / 5;
            context.lineTo(x, y);
        }
        context.lineTo(WIDTH, HEIGHT);
        context.closePath();
        context.fill();
        context.strokeStyle = '#FF0';
        context.lineWidth = 2;
        context.stroke();
    }
    // Draw Depth indicator.
    context.globalAlpha = 0.5;
    let depth = 5 * Math.max(1, Math.floor( (state.camera.top / (ROW_HEIGHT / 2) - 1) / 5));
    let y = (depth + 1) * ROW_HEIGHT / 2 - state.camera.top;
    while (y < HEIGHT) {
        let size = 15;
        if (!(depth % 50)) size = 30;
        else if (!(depth % 10)) size = 20;
        drawText(context, `${depth} -`, 10, y, {fillStyle: '#FFF', textAlign: 'left', textBaseline: 'middle', size});
        y += 5 * ROW_HEIGHT / 2;
        depth += 5;
    }
    context.restore();
}

function renderCell(context, state, row, column) {
    drawCellPath(context, state, row, column);
    const columnz = z(column);
    const cell = state.rows[row] && state.rows[row][columnz];
    context.lineWidth = 1;
    if (!cell) {
        context.fillStyle = '#444';
        context.fill();
        context.strokeStyle = '#666';
        context.stroke();
        return;
    }
    if (cell.destroyed &&
        (!state.spriteMap[cell.spriteId] || state.spriteMap[cell.spriteId].ending)
    ) {
        const points = getCellPoints(state, row, column);
        context.beginPath();
        context.moveTo(points[0][0], points[0][1]);
        context.lineTo(points[2][0], points[2][1]);
        context.moveTo((points[0][0] + points[5][0]) / 2, (points[0][1] + points[5][1]) / 2);
        context.lineTo((points[2][0] + points[3][0]) / 2, (points[2][1] + points[3][1]) / 2);
        context.moveTo(points[5][0], points[5][1]);
        context.lineTo(points[3][0], points[3][1]);

        context.moveTo(points[1][0], points[1][1]);
        context.lineTo(points[5][0], points[5][1]);
        context.moveTo((points[1][0] + points[2][0]) / 2, (points[1][1] + points[2][1]) / 2);
        context.lineTo((points[5][0] + points[4][0]) / 2, (points[5][1] + points[4][1]) / 2);
        context.moveTo(points[2][0], points[2][1]);
        context.lineTo(points[4][0], points[4][1]);
        context.lineWidth = 3;
        context.strokeStyle = '#F40';
        context.stroke();
    } else if (isCellRevealed(state, row, column)) {
        // Currently do nothing here.
    } else {
        context.fillStyle = '#AAA';
        context.fill();
        context.strokeStyle = '#666';
        context.stroke();
        const flagValue = getFlagValue(state, row, column);
        if (flagValue) {
            const points = getCellPoints(state, row, column);
            context.beginPath();
            context.moveTo(points[0][0], points[0][1]);
            context.lineTo(points[3][0], points[3][1]);
            context.moveTo(points[1][0], points[1][1]);
            context.lineTo(points[4][0], points[4][1]);
            context.moveTo(points[2][0], points[2][1]);
            context.lineTo(points[5][0], points[5][1]);
            context.strokeStyle = flagValue == 2 ? 'red' : 'green';
            context.stroke();
        }
    }
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `${EDGE_LENGTH / 2 + 12}px sans-serif`;
    const centerX = column * COLUMN_WIDTH + SHORT_EDGE + Math.round(EDGE_LENGTH / 2) - Math.round(state.camera.left);
    if (!cell.destroyed && cell.crystals > 0) {
        const centerY = row * ROW_HEIGHT + ((column % 2) ? LONG_EDGE : 0)
            + Math.round(LONG_EDGE / 2) - Math.round(state.camera.top);
        context.fillStyle = '#0AF';
        context.fillText(cell.crystals, centerX, centerY);
        context.lineWidth = 2;
        context.strokeStyle = '#048';
        context.strokeText(cell.crystals, centerX, centerY);
    }
    if (!cell.destroyed && cell.traps > 0) {
        //context.font = `${EDGE_LENGTH / 2 + 4}px sans-serif`;
        const centerY = row * ROW_HEIGHT + ((column % 2) ? LONG_EDGE : 0) + LONG_EDGE
            + Math.round(LONG_EDGE / 2) - Math.round(state.camera.top);
        context.fillStyle = '#FCC';
        context.fillText(cell.traps, centerX, centerY);
        context.lineWidth = 2;
        context.strokeStyle = '#400';
        context.strokeText(cell.traps, centerX, centerY);
    }
}
function drawCellPath(context, state, row, column) {
    const cellPoints = getCellPoints(state, row, column);
    context.beginPath();
    context.moveTo(cellPoints[0][0], cellPoints[0][1]);
    cellPoints.shift();
    for (const point of cellPoints) context.lineTo(point[0], point[1]);
    context.closePath();
}
function getCellPoints(state, row, column) {
    const x = column * COLUMN_WIDTH - state.camera.left;
    const y = row * ROW_HEIGHT - state.camera.top + ((column % 2) ? LONG_EDGE : 0);
    return [
        [x + SHORT_EDGE, y],
        [x + SHORT_EDGE + EDGE_LENGTH, y],
        [x + SHORT_EDGE + EDGE_LENGTH + SHORT_EDGE, y + LONG_EDGE],
        [x + SHORT_EDGE + EDGE_LENGTH, y + ROW_HEIGHT],
        [x + SHORT_EDGE, y + ROW_HEIGHT],
        [x, y + LONG_EDGE]
    ];
}

module.exports = {
    renderDigging
};

// const { skullFrame } = require('sprites');
