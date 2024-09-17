const {
    canvas,
    EDGE_LENGTH,
    SHORT_EDGE,
    LONG_EDGE,
    COLUMN_WIDTH,
    ROW_HEIGHT,
} = require('gameConstants');

const random = require('random');
const Rectangle = require('Rectangle');
const { createAnimation, requireImage, r } = require('animations');
const { drawImage, drawText } = require('draw');
const { renderRobot } = require('renderRobot');
const { IS_DEMO } = require('isDemo');

const {
    z, canExploreCell, getFuelCost, isCellRevealed,
    getFlagValue, getCellCenter,
} = require('digging');
const { getShipPartLocation, renderShip, renderTransitionShipBackground } = require('ship');

let lavaPattern = null;
function renderDigging(context, state) {
    renderBackground(context, state);

    const topRow = Math.max(0, Math.floor(state.camera.top / ROW_HEIGHT - 1));
    const rows = Math.ceil(canvas.height / ROW_HEIGHT) + 2;
    const leftColumn = Math.floor(state.camera.left / COLUMN_WIDTH) - 1;
    const columns = Math.ceil(canvas.width / COLUMN_WIDTH) + 2;

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
    renderRobot(context, state);
    if (state.leaving || state.incoming) {
        renderShip(context, state);
    }
    if (!state.collectingPart) {
        for (let row = topRow; row < topRow + rows; row++) {
            for (let column = leftColumn; column < leftColumn + columns; column++) {
                renderCellShading(context,state, row, column, state.camera.top, state.camera.left);
            }
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
                context.strokeStyle = (fuelCost <= state.saved.fuel  && isFlagged !== 2) ? '#0F0' : 'red';
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
    const lavaIsLowering = state.displayLavaDepth < state.saved.lavaDepth;
    if (lavaDepthY < canvas.height + 200) {
        const gradientRGB = lavaIsLowering ? '0, 255, 50' : '255, 255, 0';
        let gradient = context.createLinearGradient(0, lavaDepthY - 150, 0, lavaDepthY + ROW_HEIGHT / 2);
        gradient.addColorStop(0.05 + Math.sin(state.time / 500) * 0.05, `rgba(${gradientRGB}, 0.0)`);
        gradient.addColorStop(.90, `rgba(${gradientRGB}, 0.8)`);
        context.fillStyle = gradient;
        context.fillRect(0, lavaDepthY + waveHeight - 200, canvas.width, canvas.height + 200);
    }
    if (lavaDepthY < canvas.height + ROW_HEIGHT / 2) {
        context.save();
        context.globalAlpha = 0.7;
        context.fillStyle = lavaPattern || 'red';
        context.beginPath();
        const numPoints = 30;
        context.moveTo(0, canvas.height);
        for (let i = 0; i <= numPoints; i++) {
            const x = canvas.width * i / numPoints;
            const y = lavaDepthY - 7
                + waveHeight * Math.sin((x * 2 + state.time / 2) / 100) / 20
                + waveHeight * Math.sin((x * 2 + state.time / 2) / 200) / 10
                + waveHeight * Math.sin((x * 2 + state.time / 2) / 500) / 5;
            context.lineTo(x, y);
        }
        context.lineTo(canvas.width, canvas.height);
        context.closePath();
        context.translate(-state.camera.left + state.time / 100, lavaDepthY - state.time / 200);
        context.fill();
        context.strokeStyle = lavaIsLowering ? '#0a5' : '#FF0';
        context.lineWidth = 2;
        context.stroke();
        context.restore();
    }
    // Draw Depth indicator.
    context.globalAlpha = 0.5;
    let depth = 5 * Math.max(1, Math.floor( (state.camera.top / (ROW_HEIGHT / 2) - 1) / 5));
    let y = (depth + 1) * ROW_HEIGHT / 2 - state.camera.top;
    while (y < canvas.height) {
        let size = 15;
        if (!(depth % 50)) size = 30;
        else if (!(depth % 10)) size = 20;
        drawText(context, `${depth} -`, 10, y, {fillStyle: '#FFF', textAlign: 'left', textBaseline: 'middle', size});
        if (IS_DEMO && depth <= state.displayLavaDepth && depth + 5 > state.displayLavaDepth) {
            context.save();
            context.globalAlpha = 1;
            const alert = {
                label: 'Purchase the full game to\nlower the lava and dig deeper.',
                textProperties: {fillStyle: 'white', textAlign: 'center', textBaseline: 'middle', size: 36},
            }
            drawText(context, alert.label, canvas.width / 2, y, alert.textProperties);
            context.restore();
        }
        y += 5 * ROW_HEIGHT / 2;
        depth += 5;
    }
    context.restore();
}
function renderBackground(context, state) {
    const height = 200, width = 200;
    const topRow = Math.max(0, Math.floor(state.camera.top / height));
    const leftColumn = Math.floor(state.camera.left / width) - 1;
    const columns = Math.ceil(canvas.width / height) + 2;
    const rows = Math.ceil(canvas.height / width) + 1;
    for (let row = topRow + rows - 1; row >= topRow; row--) {
        let y = Math.round(row * height - state.camera.top);
        const index = Math.min(cellBackgrounds.length - 1, Math.floor(row / 5));
        const frame = cellBackgrounds[index].frames[0];
        for (let column = leftColumn; column < leftColumn + columns; column++) {
            let x = Math.round(column * width - state.camera.left);
            drawImage(context, frame.image, frame, new Rectangle(0,0,width,height).moveTo(x, y));
        }
    }
    context.save();
    let gradient = context.createLinearGradient(0, 0, 0, 500);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.7)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    renderTransitionShipBackground(context, state);
   /* if (state.camera.top < 0) {
        context.fillStyle = '#08F';
        context.fillRect(0, 0, canvas.width, -state.camera.top);
    }*/
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
    const columns = Math.ceil(canvas.width / width) + 2;
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
    const columns = Math.ceil(canvas.width / COLUMN_WIDTH) + 2;
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

const crystalPip = r(13, 13, {image: requireImage('gfx/pips.png')});
const bombPip = r(13, 13, {left: 13, image: requireImage('gfx/pips.png')});
const specialPip = r(13, 13, {left: 26, image: requireImage('gfx/pips.png')});
function renderCellShading(context, state, row, column) {
    const columnz = z(column);
    const cell = state.rows[row] && state.rows[row][columnz];
    if (!cell || cell.destroyed) return;
    context.strokeStyle = '#FFF';
    // Visual aide to count pips in background cell
    if (cell.numbersRevealed && (cell.crystals || cell.traps || cell.treasures) && isCellRevealed(state, row, column)) {
        drawCellPath(context, state, row, column, 5);
        context.save();
        context.globalAlpha = 0.2;
        context.lineWidth = 4;
        context.stroke();
        context.restore();
    }
    // Indicator that the player can explore this cell:
    if (!isCellRevealed(state, row, column)) {
        const shipPartLocation = getShipPartLocation(state);
        const p1 = getCellCenter(state, shipPartLocation.row, shipPartLocation.column);
        const p2 = getCellCenter(state, row, column);
        const dy = p1.y - p2.y, dx = p1.x - p2.x;
        const d2 = dx * dx + dy * dy;
        drawCellPath(context, state, row, column, 5);
        context.save();
        const p = Math.round(Math.max(0, 1 - d2 / 500000) * 5) / 5;
        context.globalAlpha = 0.15 + p * p * (0.25 + 0.25 * Math.sin(state.time / 500));
        context.lineWidth = 6;
        context.stroke();
        if (!cell.destroyed && cell.numbersRevealed) {
            context.fillStyle = '#FFF';
            context.fill();
        }
        context.restore();
    }
    // Indicators for the number of crystals and bombs near this cell.
    if (!cell.destroyed && (cell.crystals || cell.traps || cell.treasures)) {
        if (COLUMN_WIDTH) {
            const pips = getPipPoints(state, row, column);
            context.fillStyle = '#8CF';
            context.strokeStyle = '#04F';
            context.lineWidth = 1;
            for(let i = 0; i < cell.crystals; i++) {
                drawImage(context, crystalPip.image, crystalPip,
                    new Rectangle(crystalPip).moveCenterTo(pips[i][0], pips[i][1]).round());
            }
            for(let i = cell.crystals; i < cell.crystals + cell.treasures; i++) {
                drawImage(context, specialPip.image, specialPip,
                    new Rectangle(specialPip).scale(2).moveCenterTo(pips[i][0], pips[i][1]).round());
            }
            context.fillStyle = '#FCC';
            context.strokeStyle = '#800';
            for(let i = 0; i < cell.traps; i++) {
                drawImage(context, bombPip.image, bombPip,
                    new Rectangle(bombPip).moveCenterTo(pips[6 - i][0], pips[6 - i][1]).round());
            }
        } else {
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.font = `${EDGE_LENGTH / 2 + 12}px sans-serif`;
            const centerX = column * COLUMN_WIDTH + SHORT_EDGE + Math.round(EDGE_LENGTH / 2) - Math.round(state.camera.left);
            if (cell.crystals) {
                const centerY = row * ROW_HEIGHT + ((column % 2) ? LONG_EDGE : 0)
                    + Math.round(LONG_EDGE / 2) - Math.round(state.camera.top);
                context.fillStyle = '#0AF';
                context.fillText(cell.crystals, centerX, centerY);
                context.lineWidth = 2;
                context.strokeStyle = '#048';
                context.strokeText(cell.crystals, centerX, centerY);
            }
            if (cell.traps) {
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
    }
}

const tAnimation = x => createAnimation('gfx/destroyed.png', r(20, 20), {x});
const trashParticles = [
    [tAnimation(0),tAnimation(1),tAnimation(2)],
    [tAnimation(0),tAnimation(1),tAnimation(2)],
    [tAnimation(3),tAnimation(4),tAnimation(5)],
    [tAnimation(6),tAnimation(7),tAnimation(8)],
    [tAnimation(9),tAnimation(10),tAnimation(11)],
    [tAnimation(9),tAnimation(10),tAnimation(11)],
    [tAnimation(12),tAnimation(13),tAnimation(14)],
    [tAnimation(12),tAnimation(13),tAnimation(14)],
    [tAnimation(15),tAnimation(16),tAnimation(17)],
    [tAnimation(15),tAnimation(16),tAnimation(17)],
];
const burnParticles = [tAnimation(18),tAnimation(19),tAnimation(20),tAnimation(21)]
function renderCell(context, state, row, column) {
    //drawCellPath(context, state, row, column);
    const columnz = z(column);
    const cell = state.rows[row] && state.rows[row][columnz];
    context.lineWidth = 1;
    /*let index = (row - 2) + Math.abs(column) % 2 + Math.abs(column) % 3 + Math.abs(column) % 5
        - ((row) % 2)- ((row) % 3);*/
    let index = row - 3 + 6 * random.normSeed(Math.cos(row) + Math.sin(columnz));
    index = Math.max(0, Math.floor(index / 10));

    const frame = cellFrames[Math.min(index, cellFrames.length - 1)].frames[0];
    const x = column * COLUMN_WIDTH - state.camera.left;
    const y = row * ROW_HEIGHT - state.camera.top + ((column % 2) ? LONG_EDGE : 0);
    if (!cell) return drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, y));
    if (cell.destroyed) {
        drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, y));
        // Don't draw the debris during the start of the explosion.
        if (state.spriteMap[cell.spriteId] && !state.spriteMap[cell.spriteId].ending) return;
        const pts = getTrashPoints(state, row, column);
        const particles = [
            ...trashParticles[Math.min(index, trashParticles.length - 1)],
            ...trashParticles[Math.min(index, trashParticles.length - 1)],
            ...burnParticles,
        ];
        for (let i = 0; i < pts.length; i++) {
            const pIndex = Math.floor(random.normSeed(row+columnz+i) * particles.length);
            //const pFrame = particles.splice(pIndex, 1)[0].frames[0];
            const pFrame = particles[pIndex].frames[0];
            drawImage(context, pFrame.image, pFrame,
                new Rectangle(pFrame).scale(3).moveCenterTo(pts[i][0], pts[i][1])
            );
        }
        /*const points = getCellPoints(state, row, column);
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
        context.stroke();*/
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
const HEX_WIDTH = 2 * EDGE_LENGTH;
function getPipPoints(state, row, column) {
    const x = column * COLUMN_WIDTH - state.camera.left;
    const y = row * ROW_HEIGHT - state.camera.top + ((column % 2) ? LONG_EDGE : 0);
    // const pad = 5;
    //const c = (Math.sin(Date.now() / 1000) + 1 ) / 2;
    const c = 0.6;
    return [
        [x + HEX_WIDTH / 4 + HEX_WIDTH / 4 * c, y + ROW_HEIGHT / 2 * c],
        [x + 3 * HEX_WIDTH / 4 - HEX_WIDTH / 4 * c, y + ROW_HEIGHT / 2 * c],
        [x + HEX_WIDTH / 2 * c, y + ROW_HEIGHT / 2],
        [x + HEX_WIDTH / 2, y + ROW_HEIGHT / 2],
        [x + HEX_WIDTH - HEX_WIDTH / 2 * c, y + ROW_HEIGHT / 2],
        [x + HEX_WIDTH / 4 + HEX_WIDTH / 4 * c, y + ROW_HEIGHT - ROW_HEIGHT / 2 * c],
        [x + 3 * HEX_WIDTH / 4 - HEX_WIDTH / 4 * c, y + ROW_HEIGHT - ROW_HEIGHT / 2 * c],
    ];
}
function getTrashPoints(state, row, column) {
    const x = column * COLUMN_WIDTH - state.camera.left;
    const y = row * ROW_HEIGHT - state.camera.top + ((column % 2) ? LONG_EDGE : 0);
    const pad = 1;
    return [
        [x + HEX_WIDTH / 2, y + ROW_HEIGHT / 6 + pad * 1.5],
        [x + SHORT_EDGE + pad, y + ROW_HEIGHT / 3 + pad],
        [x + HEX_WIDTH - SHORT_EDGE - pad, y + ROW_HEIGHT / 3 + pad],
        [x + HEX_WIDTH / 2, y + ROW_HEIGHT / 2],
        [x + SHORT_EDGE + pad, y + 2 * ROW_HEIGHT / 3 - pad],
        [x + HEX_WIDTH - SHORT_EDGE - pad, y + 2 * ROW_HEIGHT / 3 - pad],
        [x + HEX_WIDTH / 2, y + 5 * ROW_HEIGHT / 6 - pad * 1.5],
    ].map(a => a.map(Math.round));
}

module.exports = {
    renderDigging
};
