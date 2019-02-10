const {
    WIDTH,
    HEIGHT,
    EDGE_LENGTH,
    SHORT_EDGE,
    LONG_EDGE,
    COLUMN_WIDTH,
    ROW_HEIGHT,
} = require('gameConstants');

const random = require('random');
const Rectangle = require('Rectangle');
const { createAnimation, r } = require('animations');
const { drawImage, drawText } = require('draw');

const { z, canExploreCell, getFuelCost, isCellRevealed, getFlagValue } = require('digging');

let lavaPattern = null;
function renderDigging(context, state) {
    renderBackground(context, state);

    const topRow = Math.max(0, Math.floor(state.camera.top / ROW_HEIGHT - 1));
    const rows = Math.ceil(HEIGHT / ROW_HEIGHT) + 2;
    const leftColumn = Math.floor(state.camera.left / COLUMN_WIDTH) - 1;
    const columns = Math.ceil(WIDTH / COLUMN_WIDTH) + 2;

    for (let row = topRow + rows - 1; row >= topRow; row--) {
        // Draw every other tile in the row on below first.
        let extra = (leftColumn % 2) ^ 1;
        for (let column = leftColumn + extra; column < leftColumn + columns; column+=2) {
            renderCell(context,state, row, column, state.camera.top, state.camera.left);
        }
        // Then draw every other tile in the row on top.
        extra ^= 1;
        for (let column = leftColumn + extra; column < leftColumn + columns; column+=2) {
            renderCell(context,state, row, column, state.camera.top, state.camera.left);
        }
    }
    renderSurfaceTiles(context, state);
    for (let row = topRow; row < topRow + rows; row++) {
        for (let column = leftColumn; column < leftColumn + columns; column++) {
            renderCellShading(context,state, row, column, state.camera.top, state.camera.left);
        }
    }
    if (state.overButton && state.overButton.cell) {
        let {row, column} = state.overButton;
        context.lineWidth = 2;
        const columnz = z(column);
        const cell = state.rows[row] && state.rows[row][columnz];
        if (cell && !isCellRevealed(state, row, column)) {
            if (canExploreCell(state, row, column)) {
                const fuelCost = getFuelCost(state, row, column);
                const isFlagged = getFlagValue(state, row, column);
                context.strokeStyle = (fuelCost <= state.fuel  && isFlagged !== 2) ? '#0F0' : 'red';
            } else {
                context.strokeStyle = 'red';
            }
            context.save();
            context.globalAlpha = 0.3;
            context.lineWidth = 6;
            drawCellPath(context, state, row, column, 5);
            context.stroke();
            context.restore();
        }
    }
    renderSurface(context, state);
    context.save();
    // Draw lava.
    const lavaFrame = lavaAnimation.frames[0];
    if (!lavaPattern && lavaFrame.image.imageIsLoaded) {
        const lavaCanvas = document.createElement('canvas');
        lavaCanvas.width = lavaFrame.width;
        lavaCanvas.height = lavaFrame.height;
        const lavaContext = lavaCanvas.getContext('2d');
        drawImage(lavaContext, lavaFrame.image, lavaFrame, new Rectangle(lavaFrame).moveTo(0, 0));
        lavaPattern = context.createPattern(lavaCanvas, "repeat");
    }
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
        context.save();
        context.globalAlpha = 0.7;
        context.fillStyle = lavaPattern || 'red';
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
        context.translate(-state.camera.left + state.time / 100, lavaDepthY - state.time / 200);
        context.fill();
        context.strokeStyle = '#FF0';
        context.lineWidth = 2;
        context.stroke();
        context.restore();
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
function renderBackground(context, state) {
    const height = 200, width = 200;
    const topRow = Math.max(0, Math.floor(state.camera.top / height));
    const leftColumn = Math.floor(state.camera.left / width) - 1;
    const columns = Math.ceil(WIDTH / height) + 2;
    const rows = Math.ceil(HEIGHT / width) + 1;
    for (let row = topRow + rows - 1; row >= topRow; row--) {
        let y = row * height - state.camera.top;
        const index = Math.min(cellBackgrounds.length - 1, Math.floor(row / 5));
        const frame = cellBackgrounds[index].frames[0];
        for (let column = leftColumn; column < leftColumn + columns; column++) {
            let x = column * width - state.camera.left;
            drawImage(context, frame.image, frame, new Rectangle(0,0,width,height).moveTo(x, y));
        }
    }
    context.save();
    let gradient = context.createLinearGradient(0, 0, 0, 500);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.7)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.restore();
    if (state.camera.top < 0) {
        context.fillStyle = '#08F';
        context.fillRect(0, 0, WIDTH, -state.camera.top);
    }
}
const grassRoots = createAnimation('gfx/grasstiles.png', r(50, 50), {x: 0}).frames[0];
const grassFrames = [
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 2}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 3}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 2}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 3}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 2}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 3}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 8}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 9}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 8}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 9}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 10}).frames[0],
];
const decorationFrames = [
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 4}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 5}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 6}).frames[0],
    createAnimation('gfx/grasstiles.png', r(50, 50), {x: 7}).frames[0],
];
function renderSurface(context, state) {
    const width = 50;
    const leftColumn = Math.floor(state.camera.left / width) - 1;
    const columns = Math.ceil(WIDTH / width) + 2;
    // This is bottom half of the top type of cell.
    if (state.camera.top < LONG_EDGE) {
        for (let column = leftColumn; column < leftColumn + columns; column++) {
            const roll =random.normSeed(column * 2);
            let frame = grassFrames[Math.floor(roll*grassFrames.length)];
            const x = width * column - state.camera.left;
            const y = - state.camera.top;
            drawImage(context, grassRoots.image, grassRoots, new Rectangle(grassRoots).moveTo(x, y));
            drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, y - 48));
            if (roll < 0.3) {
                frame = decorationFrames[Math.floor(decorationFrames.length * roll / 0.3)];
                drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, y - 48));
            }
        }
    }
}
function renderSurfaceTiles(context, state) {
    const leftColumn = Math.floor(state.camera.left / COLUMN_WIDTH) - 1;
    const columns = Math.ceil(WIDTH / COLUMN_WIDTH) + 2;
    // This is bottom half of the top type of cell.
    const frame = {...cellFrames[0].frames[0], top: 45, height:46};
    if (state.camera.top < LONG_EDGE) {
        for (let column = leftColumn + (leftColumn % 2) ^ 1; column < leftColumn + columns; column+=2) {
            const x = COLUMN_WIDTH * column - state.camera.left;
            const y = - state.camera.top+2;
            drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, y));
        }
    }
}

const cellFrames = [
    createAnimation('gfx/hex.png', r(100, 91), {x: 1}),
    createAnimation('gfx/hex.png', r(100, 91), {x: 2}),
    createAnimation('gfx/hex.png', r(100, 91), {x: 3}),
    createAnimation('gfx/hex.png', r(100, 91), {x: 4}),
    createAnimation('gfx/hex.png', r(100, 91), {x: 5}),
    createAnimation('gfx/hex.png', r(100, 91), {x: 6}),
    createAnimation('gfx/hex.png', r(100, 91), {x: 7}),
    createAnimation('gfx/hex.png', r(100, 91), {x: 8}),
    createAnimation('gfx/hex.png', r(100, 91), {x: 9}),
    createAnimation('gfx/hex.png', r(100, 91), {x: 10}),
];
const cellBackgrounds = [
    createAnimation('gfx/dirtback.png', r(100, 100), {x: 0}),
    createAnimation('gfx/dirtback.png', r(100, 100), {x: 1}),
    createAnimation('gfx/dirtback.png', r(100, 100), {x: 2}),
    createAnimation('gfx/dirtback.png', r(100, 100), {x: 3}),
    createAnimation('gfx/dirtback.png', r(100, 100), {x: 4}),
    createAnimation('gfx/dirtback.png', r(100, 100), {x: 5}),
    createAnimation('gfx/dirtback.png', r(100, 100), {x: 6}),
    createAnimation('gfx/dirtback.png', r(100, 100), {x: 7}),
    createAnimation('gfx/dirtback.png', r(100, 100), {x: 8}),
];
const lavaAnimation = createAnimation('gfx/back.png', r(100, 100), {x: 4});
function renderCellShading(context, state, row, column) {
    const columnz = z(column);
    const cell = state.rows[row] && state.rows[row][columnz];
    if (!cell || cell.destroyed || isCellRevealed(state, row, column)) return;
    drawCellPath(context, state, row, column, 5);
    context.save();
    context.strokeStyle = '#FFF';
    context.globalAlpha = 0.15;
    context.lineWidth = 6;
    context.stroke();
    context.restore();
}
function renderCell(context, state, row, column) {
    drawCellPath(context, state, row, column);
    const columnz = z(column);
    const cell = state.rows[row] && state.rows[row][columnz];
    context.lineWidth = 1;
    /*let index = (row - 2) + Math.abs(column) % 2 + Math.abs(column) % 3 + Math.abs(column) % 5
        - ((row) % 2)- ((row) % 3);*/
    let index = row - 3 + 6 * random.normSeed(Math.cos(row) + Math.sin(columnz));
    index = Math.max(0, Math.floor(index / 10));

    const frame = cellFrames[Math.min(index, cellFrames.length - 1)].frames[0];
    if (!cell) {
        const x = column * COLUMN_WIDTH - state.camera.left;
        const y = row * ROW_HEIGHT - state.camera.top + ((column % 2) ? LONG_EDGE : 0);
        drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, y));
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
        const x = column * COLUMN_WIDTH - state.camera.left;
        const y = row * ROW_HEIGHT - state.camera.top + ((column % 2) ? LONG_EDGE : 0);
        drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, y));
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
function drawCellPath(context, state, row, column, pad = 0) {
    const cellPoints = getCellPoints(state, row, column, pad);
    context.beginPath();
    context.moveTo(cellPoints[0][0], cellPoints[0][1]);
    cellPoints.shift();
    for (const point of cellPoints) context.lineTo(point[0], point[1]);
    context.closePath();
}
function getCellPoints(state, row, column, pad = 0) {
    const x = column * COLUMN_WIDTH - state.camera.left;
    const y = row * ROW_HEIGHT - state.camera.top + ((column % 2) ? LONG_EDGE : 0);
    return [
        [x + SHORT_EDGE + pad, y + pad],
        [x + SHORT_EDGE + EDGE_LENGTH - pad, y + pad],
        [x + SHORT_EDGE + EDGE_LENGTH + SHORT_EDGE - pad, y + LONG_EDGE],
        [x + SHORT_EDGE + EDGE_LENGTH - pad, y + ROW_HEIGHT - pad],
        [x + SHORT_EDGE + pad, y + ROW_HEIGHT - pad],
        [x + pad, y + LONG_EDGE]
    ];
}

module.exports = {
    renderDigging
};

// const { skullFrame } = require('sprites');
