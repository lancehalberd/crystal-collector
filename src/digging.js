const random = require('random');

const {
    WIDTH, HEIGHT,
    EDGE_LENGTH, COLUMN_WIDTH, ROW_HEIGHT,
    SHORT_EDGE, LONG_EDGE,
} = require('gameConstants');

const CRYSTAL_SIZES = [
    1, 5, 20,
    100, 500, 2000,
    10000, 50000, 200000,
    1E6, 5E6, 20E6,
];

// Injects indexes from the integers into non-negative integers.
function z(i) {
    return (i >= 0) ? 2 * i : -2 * i - 1;
}

function getCellColor(state, row, column) {
    if (row < 0 || (row === 0 && column === 0)) return 'black';
    const startingCell = getStartingCell(state);
    if (row === startingCell.row && column === startingCell.column) return 'black';
    let roll = random.nextSeed(state.saved.seed + Math.cos(row) + Math.sin(column));
    const depth = getDepth(state, row, column);
    if (roll < Math.max(0.1, 0.4 - depth / 400)) return 'green';
    if (Math.abs(row - startingCell.row) + Math.abs(column - startingCell.column) <= 1) return 'black';
    roll = random.nextSeed(roll);
    if (roll < Math.min(0.5, 0.01 + depth / 400)) return 'red';
    return 'black';
}
function getRangeAtDepth(state, depth, rangeOffset = 0) {
    return Math.max(1, Math.min(3, (state.saved.range + rangeOffset) - 0.03 * depth));
}
function getExplosionProtectionAtDepth(state, depth, offset = 0) {
    let maxExplosionProtection = 0.5;
    maxExplosionProtection += getAchievementBonus(state, ACHIEVEMENT_PREVENT_X_EXPLOSIONS) / 100;
    return Math.max(0, Math.min(maxExplosionProtection, (state.saved.explosionProtection + offset) - 0.015 * depth));
}
function getDepth(state, row, column) {
    return row * 2 + Math.abs(column % 2);
}
function getFuelCost(state, row, column) {
    const depth = getDepth(state, row, column);
    return Math.floor((depth + 1) * Math.pow(1.04, depth));
}
function isCellRevealed(state, row, column) {
    const columnz = z(column);
    return state.rows[row] && state.rows[row][columnz] && state.rows[row][columnz].explored;
}
function getFlagValue(state, row, column) {
    return state.flags[row] && state.flags[row][z(column)];
}
function createCellsInRange(state, row, column) {
    if (row < 0) return false;
    const range = Math.round(getRangeAtDepth(state, getDepth(state, row, column)));
    const candidatesForReveal = [];
    for (const cellCoords of  getCellsInRange(state, row, column, range)) {
        state = createCell(state, cellCoords.row, cellCoords.column);
        candidatesForReveal[cellCoords.distance] = candidatesForReveal[cellCoords.distance] || [];
        if (!state.rows[cellCoords.row][z(cellCoords.column)].numbersRevealed) {
            candidatesForReveal[cellCoords.distance].push(cellCoords);
        }
    }
    const bonusChance = getAchievementBonus(state, ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY) / 100;
    for (let i = 1; i <= range; i++) {
        // When your range exceeds 1, you get 1 extra bonus cell revealed in each ring that is
        // not at your maximum range.
        if (i < range && candidatesForReveal[i].length) {
            const coords = random.removeElement(candidatesForReveal[i]);
            state = revealCellNumbers(state, coords.row, coords.column);
        }
        // With bonus chance to reveal information, you have a % chance to reveal an extra cell
        // in each ring within your range, including your maximum range.
        if (Math.random() < bonusChance && candidatesForReveal[i].length) {
            const coords = random.removeElement(candidatesForReveal[i]);
            state = revealCellNumbers(state, coords.row, coords.column);
        }
    }
    return state;
}
function getCellsInRange(state, row, column, range) {
    const cellsInRange = [];
    const minColumn = column - range, maxColumn = column + range;
    for (let checkColumn = minColumn; checkColumn <= maxColumn; checkColumn++) {
        const dx = Math.abs(column - checkColumn);
        let minRow, maxRow;
        if (!(dx % 2)) {
            minRow = (row - (range - dx / 2));
            maxRow = (row + (range - dx / 2));
        } else {
            if (column % 2) {
                minRow = (row - Math.floor(range - dx / 2));
                maxRow = (row + Math.ceil(range - dx / 2));
            } else {
                minRow = (row - Math.ceil(range - dx / 2));
                maxRow = (row + Math.floor(range - dx / 2));
            }
        }
        for (let checkRow = minRow; checkRow <= maxRow; checkRow++) {
            if (checkRow < 0) continue;
            let distance = Math.max(
                range - Math.min(checkColumn - minColumn, maxColumn - checkColumn),
                range - Math.min(checkRow - minRow, maxRow - checkRow)
            );
            cellsInRange.push({row: checkRow, column: checkColumn, distance});
        }
    }
    return cellsInRange;
}

const SLOPE = LONG_EDGE / SHORT_EDGE;

function createCell(state, row, column) {
    if (row < 0) return state;
    const columnz = z(column);
    if (state.rows[row] && state.rows[row][columnz]) return state;
    const selectedRow = [...(state.rows[row] || [])];
    selectedRow[columnz] = {cellsToUpdate: []};
    const rows = [...state.rows];
    rows[row] = selectedRow
    return {...state, rows};
}
function canExploreCell(state, row, column) {
    const columnz = z(column);
    return state.rows[row] && state.rows[row][columnz] && !state.rows[row][columnz].explored;
}

function revealCell(state, row, column) {
    state = revealCellNumbers(state, row, column);
    state = updateCell(state, row, column, {explored: true});
    const maxDepth = Math.max(state.saved.maxDepth, getDepth(state, row, column));
    if (maxDepth !== state.saved.maxDepth) {
        state = {
            ...state,
            saved: {...state.saved, maxDepth},
        };
    }
    return createCellsInRange(state, row, column);
}
function revealCellNumbers(state, row, column) {
    if (row < 0) return state;
    state = createCell(state, row, column);
    if (state.rows[row][z(column)].numbersRevealed) return state;
    let crystals = 0, traps = 0, numbersRevealed = true;
    const rowOffset = Math.abs(column % 2);
    const cells = [
        [column - 1, row + rowOffset - 1], [column - 1, row + rowOffset],
        [column, row - 1], [column, row], [column, row + 1],
        [column + 1, row + rowOffset - 1], [column + 1, row + rowOffset],
    ];
    for (const cell of cells) {
        if (cell[1] < 0) continue;
        state = createCell(state, cell[1], cell[0]);
        const cellColor = getCellColor(state, cell[1], cell[0]);
        if (!isCellRevealed(state, cell[1], cell[0]) && (cellColor === 'green' || cellColor === 'red')) {
            const updatedCell = state.rows[cell[1]][z(cell[0])];
            /*const updatedRow = [...state.rows[cell[1]]];
            updatedRow[cell[0]] = {...updatedRow[cell[0]], cellsToUpdate: [...updatedRow[cell[0]].cellsToUpdate, {row, column}]};
            state = {...state, rows: {...state.rows, [cell[1]]: updatedRow}};*/

            state = updateCell(state, cell[1], cell[0], {cellsToUpdate: [...updatedCell.cellsToUpdate, {row, column}]});
            if (cellColor === 'green') crystals++;
            if (cellColor === 'red') traps++;
        }
    }
    let explored = state.rows[row][z(column)].explored || (crystals === 0 && traps === 0);
    return updateCell(state, row, column, {crystals, traps, numbersRevealed, explored});
}

function updateCell(state, row, column, properties) {
    const columnz = z(column);
    const updatedRow = [...state.rows[row]];
    updatedRow[columnz] = {...updatedRow[columnz], ...properties}
    const rows = [...state.rows];
    rows[row] = updatedRow;
    return {...state, rows};
}
function getOverCell(state, {x, y}) {
    if (state.shop || state.showAchievements) return null;
    x += state.camera.left;
    y += state.camera.top;
    let column = Math.floor(x / COLUMN_WIDTH);
    let rowOffset = (column % 2) ? ROW_HEIGHT / 2 : 0;
    let row = Math.floor((y + rowOffset) / ROW_HEIGHT);
    let top = row * ROW_HEIGHT - rowOffset;
    let left = column * COLUMN_WIDTH;
    if (x < left + SHORT_EDGE) {
        if (y < top + LONG_EDGE) {
            const lineY = top + LONG_EDGE - SLOPE * (x - left);
            if (y < lineY) {
                left -= COLUMN_WIDTH;
                top -= ROW_HEIGHT / 2;
            }
        } else {
            const lineY = top + LONG_EDGE + SLOPE * (x - left);
            if (y > lineY) {
                left -= COLUMN_WIDTH;
                top += ROW_HEIGHT / 2;
            }
        }
    }
    column = Math.round(left / COLUMN_WIDTH);
    rowOffset = (column % 2) ? ROW_HEIGHT / 2 : 0;
    row = Math.round((top - rowOffset) / ROW_HEIGHT);
    if (row < 0) return null;
    return {cell: true, column, row};
}

function getCellCenter(state, row, column) {
    const x = column * COLUMN_WIDTH + SHORT_EDGE + EDGE_LENGTH / 2;
    const y = row * ROW_HEIGHT + ((column % 2) ? LONG_EDGE : 0) + ROW_HEIGHT / 2;
    return {x, y};
}
function blowUpCell(state, row, column, frameDelay = 0) {
    if (row < 0) return;
    const {x, y} = getCellCenter(state, row, column);
    const newExplosion = {...explosionSprite, x, y, frame: -frameDelay};
    state = createCell(state, row, column);
    state = addSprite(state, newExplosion);
    state = updateCell(state, row, column, {destroyed: true, explored: true, spriteId: newExplosion.id});
    return {
        ...state,
        // Lose 10% of max fuel for every explosion.
        fuel: Math.max(0, Math.floor(state.fuel - state.saved.maxFuel / 10)),
    };
}

function exploreCell(state, row, column) {
    state = revealCell(state, row, column);
    const fuelCost = getFuelCost(state, row, column);
    const cellColor = getCellColor(state, row, column);
    if (cellColor === 'red') {
        const depth = getDepth(state, row, column);
        const explosionRange = Math.floor(Math.min(3, 1 + depth / 40));
        let frameDelay = 0;
        const cellsInRange = getCellsInRange(state, row, column, explosionRange).sort(
            (A, B) => A.distance - B.distance
        );
        let firstCell = true;
        for (const cellCoords of cellsInRange) {
            const depth = getDepth(state, cellCoords.row, cellCoords.column);
            if (firstCell || Math.random() >= getExplosionProtectionAtDepth(state, depth)) {
                state = blowUpCell(state, cellCoords.row, cellCoords.column, frameDelay += 2);
            } else {
                state = incrementAchievementStat(state, ACHIEVEMENT_PREVENT_X_EXPLOSIONS, 1);
            }
            firstCell = false;
        }
        for (const coordsToUpdate of state.rows[row][z(column)].cellsToUpdate) {
            const cellToUpdate = state.rows[coordsToUpdate.row][z(coordsToUpdate.column)];
            const traps = cellToUpdate.traps - 1;
            // Mark cells with no nearby traps/crystals explored since numbers are already revealed.
            let explored = cellToUpdate.explored || (!traps && !cellToUpdate.crystals);
            state = updateCell(state, coordsToUpdate.row, coordsToUpdate.column, {traps, explored});
        }
    }
    if (cellColor === 'green') {
        const depth = getDepth(state, row, column);
        state = gainBonusFuel(state, 0.1 * fuelCost);
        const {x, y} = getCellCenter(state, row, column);

        const multiplier = getAchievementBonus(state, ACHIEVEMENT_COLLECT_X_CRYSTALS) / 100;
        const amount = Math.round((depth + 1) * Math.pow(1.05, depth) * (1 + multiplier));

        state = spawnCrystals(state, x, y, amount);
        for (const coordsToUpdate of state.rows[row][z(column)].cellsToUpdate) {
            const cellToUpdate = state.rows[coordsToUpdate.row][z(coordsToUpdate.column)];
            const crystals = cellToUpdate.crystals - 1;
            // Mark cells with no nearby traps/crystals explored since numbers are already revealed.
            let explored = cellToUpdate.explored || (!crystals && !cellToUpdate.traps);
            state = updateCell(state, coordsToUpdate.row, coordsToUpdate.column, {crystals, explored});
        }
    } else {
        state = {...state, fuel: Math.max(0, state.fuel - fuelCost)};
    }
    if (!state.saved.playedToday) {
        state = {...state, saved: {...state.saved, playedToday: true}};
    }
    return state;
}
function getStartingCell(state) {
    return {row: Math.floor(state.startingDepth / 2), column: 0};
}

function advanceDigging(state) {
    const startingCell = getStartingCell(state);
    if (!state.rows[startingCell.row]) {
        state = revealCell(state, startingCell.row, startingCell.column);
        state = {...state, selected: startingCell};
    }
    let camera = {...state.camera};
    if ((state.rightClicked || (state.clicked && state.usingBombDiffuser)) && state.overButton && state.overButton.cell) {
        const {row, column} = state.overButton;
        if (canExploreCell(state, row, column)) {
            if (state.bombDiffusers > 0) {
                state = {...state, bombDiffusers: state.bombDiffusers - 1};
                const cellColor = getCellColor(state, row, column);
                const {x, y} = getCellCenter(state, row, column);
                if (cellColor === 'red') {
                    state = revealCell(state, row, column);
                    state = {...state, bombsDiffusedToday: state.bombsDiffusedToday + 1};
                    state = incrementAchievementStat(state, ACHIEVEMENT_DIFFUSE_X_BOMBS, 1);
                    const bombDiffusionMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS) / 100;
                    const bonusFuel = state.saved.maxFuel * 0.05 * bombDiffusionMultiplier;
                    // Decrease the bomb count around the diffused bomb
                    for (const coordsToUpdate of state.rows[row][z(column)].cellsToUpdate) {
                        const cellToUpdate = state.rows[coordsToUpdate.row][z(coordsToUpdate.column)];
                        const traps = cellToUpdate.traps - 1;
                        // Mark cells with no nearby traps/crystals explored since numbers are already revealed.
                        let explored = cellToUpdate.explored || (!traps && !cellToUpdate.crystals);
                        state = updateCell(state, coordsToUpdate.row, coordsToUpdate.column, {traps, explored});
                    }
                    state = addSprite(state, {...bombSprite, x, y, bonusFuel, frame: -30});
                } else {
                    state = exploreCell(state, row, column);
                    state = addSprite(state, {...diffuserSprite, x, y, frame: -20});
                }
            } else {
                const selectedRow = [...(state.flags[row] || [])];
                let flagValue = getFlagValue(state, row, column) || 0;
                if (flagValue === 2) {
                    delete selectedRow[z(column)];
                } else {
                    selectedRow[z(column)] = 2;
                }
                const flags = [...state.flags];
                flags[row] = selectedRow;
                state = {...state, flags};
            }
            state = {...state, selected: state.overButton};
        }
        state = {...state, usingBombDiffuser: false, clicked: false, rightClicked: false};
    }
    if (!state.rightClicked && state.clicked && state.overButton && state.overButton.cell) {
        const {row, column} = state.overButton;
        const fuelCost = getFuelCost(state, row, column);
        if (canExploreCell(state, row, column) && getFlagValue(state, row, column) !== 2 && fuelCost <= state.fuel) {
            state = exploreCell(state, row, column);
        }
        if (isCellRevealed(state, row, column) || getFlagValue(state, row, column)) {
            state.selected = state.overButton;
        }
    }
    if (state.selected) {
        const targetLeft = state.selected.column * COLUMN_WIDTH + SHORT_EDGE + EDGE_LENGTH / 2 - WIDTH / 2;
        const rowOffset = (state.selected.column % 2) ? ROW_HEIGHT / 2 : 0;
        const targetTop = Math.max(-100, (state.selected.row + 0.5) * ROW_HEIGHT + rowOffset - HEIGHT / 2);
        camera.top = Math.round((camera.top * 10 + targetTop) / 11);
        camera.left = Math.round((camera.left * 10 + targetLeft) / 11);
    }
    let saved = state.saved;
    let displayFuel = state.displayFuel;
    if (displayFuel < state.fuel) displayFuel = Math.ceil((displayFuel * 10 + state.fuel) / 11);
    if (displayFuel > state.fuel) displayFuel = Math.floor((displayFuel * 10 + state.fuel) / 11);
    return {...state, camera, displayFuel, saved };
}
function spawnCrystals(state, x, y, amount) {
    const crystalValues = [];
    for (let sizeIndex = CRYSTAL_SIZES.length - 1; sizeIndex >= 0; sizeIndex--) {
        const crystalSize = CRYSTAL_SIZES[sizeIndex];
        while (amount >= crystalSize && crystalValues.length < 100) {
            crystalValues.push(crystalSize);
            amount -= crystalSize;
        }
    }
    let frame = -10;
    for (const crystalValue of crystalValues) {
        state = addSprite(state, {
            ...crystalSprite,
            x: x + Math.random() * EDGE_LENGTH - EDGE_LENGTH / 2,
            y: y + Math.random() * EDGE_LENGTH - EDGE_LENGTH / 2,
            frame: frame -= 2,
            crystals: crystalValue,
        });
    }
    return state;
}
function gainCrystals(state, amount) {
    state = {
        ...state,
        crystalsCollectedToday: state.crystalsCollectedToday + amount,
        saved: {...state.saved, score: state.saved.score + amount},
    };
    return incrementAchievementStat(state, ACHIEVEMENT_COLLECT_X_CRYSTALS, amount);
}
function gainBonusFuel(state, amount) {
    const bonusFuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_EXPLORED_DEEP_IN_X_DAYS) / 100;
    amount = Math.round(amount * bonusFuelMultiplier);
    const fuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY) / 100;
    return {
        ...state,
        fuel: Math.min(Math.round(state.saved.maxFuel * fuelMultiplier), state.fuel + amount),
        bonusFuelToday: state.bonusFuelToday + amount,
    };
}

module.exports = {
    z,
    getCellColor,
    canExploreCell,
    isCellRevealed,
    getFlagValue,
    advanceDigging,
    getFuelCost,
    getDepth,
    getRangeAtDepth,
    getCellCenter,
    getOverCell,
    getExplosionProtectionAtDepth,
    gainBonusFuel,
    CRYSTAL_SIZES,
    gainCrystals,
};

const { addSprite, bombSprite, crystalSprite, diffuserSprite, explosionSprite } = require('sprites');

const {
    getAchievementBonus,
    incrementAchievementStat,
    ACHIEVEMENT_COLLECT_X_CRYSTALS,
    ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY,
    ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY,
    ACHIEVEMENT_EXPLORED_DEEP_IN_X_DAYS,
    ACHIEVEMENT_PREVENT_X_EXPLOSIONS,
    ACHIEVEMENT_DIFFUSE_X_BOMBS,
} = require('achievements');

