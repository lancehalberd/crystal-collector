const random = require('random');
const { IS_DEMO } = require('isDemo');

const {
    canvas,
    FRAME_LENGTH,
    EDGE_LENGTH, COLUMN_WIDTH, ROW_HEIGHT,
    SHORT_EDGE, LONG_EDGE,
} = require('gameConstants');

const CRYSTAL_SIZES = [
    1, 5,
    10, 25,
    100, 500,
    1000, 2500,
    10000, 50000,
    100000, 250000,
    1E6, 5E6,
    10E6, 25E6,
];

module.exports = {
    z,
    getCellColor,
    canExploreCell,
    createCell,
    createCellsInRange,
    isCellRevealed,
    getFlagValue,
    advanceDigging,
    getFuelCost,
    getDepth,
    getRangeAtDepth,
    getDepthOfRange,
    getCellCenter,
    getOverCell,
    getMaxExplosionProtection,
    getExplosionProtectionAtDepth,
    getDepthOfExplosionProtection,
    gainBonusFuel,
    CRYSTAL_SIZES,
    gainCrystals,
    spawnCrystals,
    detonateDebris,
    teleportOut,
    getTopTarget,
    revealCellNumbers,
};

const { playSound, updateSave, nextDay } = require('state');

const {
    addSprite,
    bombSprite,
    crystalSprite,
    debrisSprite,
    diffuserSprite,
    shipDebrisSprite,
    explosionSprite,
    shieldSprite,
    particleAnimations,
    lavaBubbleSprite,
    lavaBubbleAnimations,
} = require('sprites');

const {
    getAchievementBonus,
    incrementAchievementStat,
    ACHIEVEMENT_COLLECT_X_CRYSTALS,
    ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY,
    ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY,
    ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS,
    ACHIEVEMENT_PREVENT_X_EXPLOSIONS,
    ACHIEVEMENT_DIFFUSE_X_BOMBS,
} = require('achievements');

const { collectTreasure } = require('treasures');

const { collectShipPart, getShipPartLocation } = require('ship');
const { teleportInAnimationFinish, teleportOutAnimationStart, teleportOutAnimationFinish } = require('renderRobot');
const { showLeavingHint, showSpecialHint } = require('help');
const { getSleepButton } = require('hud');

// Injects indexes from the integers into non-negative integers.
function z(i) {
    return (i >= 0) ? 2 * i : -2 * i - 1;
}

function getCellColor(state, row, column) {
    if (row < 0 || (row === 0 && column === 0)) return 'black';
    const startingCell = getStartingCell(state);
    if (row === startingCell.row && column === startingCell.column) return 'black';
    const shipCell = getShipPartLocation(state);
    if (row === shipCell.row && column === shipCell.column) return 'treasure';
    const depth = getDepth(state, row, column);
    let roll = random.normSeed(state.saved.seed + Math.cos(row) + Math.sin(column));
    if (roll < Math.min(0.01, 0.005 + depth * 0.0001)) return 'treasure';
    roll = random.normSeed(roll);
    if (roll < Math.max(0.15, 0.4 - depth * 0.002)) return 'green';
    if (Math.abs(row - startingCell.row) + Math.abs(column - startingCell.column) <= 1) return 'black';
    roll = random.normSeed(roll);
    // Bombs will not appear until depth 6.
    if (roll < Math.min(0.4, Math.max(0, -0.01 + depth * 0.002))) return 'red';
    return 'black';
}
function getRangeAtDepth(state, depth, rangeOffset = 0) {
    return Math.max(1, Math.min(3, (0.5 + state.saved.range + rangeOffset) - 0.04 * depth));
}
function getDepthOfRange(state, range, rangeOffset = 0) {
    return Math.round((0.5 + state.saved.range + rangeOffset - range) / 0.04);
}
function getMaxExplosionProtection(state) {
    return 0.5 + getAchievementBonus(state, ACHIEVEMENT_PREVENT_X_EXPLOSIONS) / 100;
}
window.getMaxExplosionProtection = getMaxExplosionProtection;
function getExplosionProtectionAtDepth(state, depth, offset = 0) {
    return Math.max(0, Math.min(getMaxExplosionProtection(state), (state.saved.explosionProtection + 0.1 + offset) - 0.015 * depth));
}
window.getExplosionProtectionAtDepth = getExplosionProtectionAtDepth;
function getDepthOfExplosionProtection(state, percent, offset = 0) {
    if (percent > getMaxExplosionProtection(state)) return 0;
    return Math.floor((percent - (state.saved.explosionProtection + 0.1 + offset)) / -0.015);
}
window.getDepthOfExplosionProtection = getDepthOfExplosionProtection;
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
function createCellsInRange(state, row, column, revealAll = false, onlyInRange = 0) {
    if (row < 0) return false;
    let range = Math.round(getRangeAtDepth(state, getDepth(state, row, column)));
    if (onlyInRange) range = onlyInRange;
    else if (revealAll) range = 3;
    const candidatesForReveal = [];
    for (const cellCoords of getCellsInRange(state, row, column, range)) {
        state = createCell(state, cellCoords.row, cellCoords.column);
        if (onlyInRange) {
            continue;
        }
        candidatesForReveal[cellCoords.distance] = candidatesForReveal[cellCoords.distance] || [];
        if (!state.rows[cellCoords.row][z(cellCoords.column)].numbersRevealed) {
            candidatesForReveal[cellCoords.distance].push(cellCoords);
        }
    }
    if (onlyInRange) {
        return state;
    } if (revealAll) {
        for (const candidates of candidatesForReveal) {
            for (const coords of candidates) {
                state = revealCellNumbers(state, coords.row, coords.column);
            }
        }
        return state;
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
    if (state.rows[row] && state.rows[row][columnz]) {
        return state;
    }
    // Update the bounds we allow the user to drag and scroll to.
    const {x, y} = getCellCenter(state, row, column);
    state = {...state, camera: {
            ...state.camera,
            minX: Math.min(state.camera.minX, x),
            maxX: Math.max(state.camera.maxX, x),
            minY: Math.min(state.camera.minY, y),
            maxY: Math.max(state.camera.maxY, y),
        }
    };
    const selectedRow = [...(state.rows[row] || [])];
    selectedRow[columnz] = {cellsToUpdate: []};
    const rows = [...state.rows];
    rows[row] = selectedRow
    return {...state, rows};
}
function canExploreCell(state, row, column) {
    const columnz = z(column);
    return (getDepth(state, row, column) <= state.saved.lavaDepth - 1) && state.rows[row] && state.rows[row][columnz] && !state.rows[row][columnz].explored;
}

function revealCell(state, row, column) {
    state = revealCellNumbers(state, row, column);
    state = updateCell(state, row, column, {explored: true});
    const maxDepth = Math.max(state.saved.maxDepth, getDepth(state, row, column));
    if (maxDepth !== state.saved.maxDepth) state = updateSave(state, { maxDepth });
    return createCellsInRange(state, row, column);
}
function revealCellNumbers(state, row, column) {
    if (row < 0) return state;
    state = createCell(state, row, column);
    if (state.rows[row][z(column)].numbersRevealed) return state;
    let crystals = 0, traps = 0, treasures = 0, numbersRevealed = true;
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
        if (!isCellRevealed(state, cell[1], cell[0]) && (cellColor === 'green' || cellColor === 'red' || cellColor === 'treasure')) {
            const updatedCell = state.rows[cell[1]][z(cell[0])];
            /*const updatedRow = [...state.rows[cell[1]]];
            updatedRow[cell[0]] = {...updatedRow[cell[0]], cellsToUpdate: [...updatedRow[cell[0]].cellsToUpdate, {row, column}]};
            state = {...state, rows: {...state.rows, [cell[1]]: updatedRow}};*/

            state = updateCell(state, cell[1], cell[0], {cellsToUpdate: [...updatedCell.cellsToUpdate, {row, column}]});
            if (cellColor === 'green') crystals++;
            if (cellColor === 'red') traps++;
            if (cellColor === 'treasure') treasures++;
        }
    }
    //let explored = state.rows[row][z(column)].explored || (crystals === 0 && traps === 0 && treasures === 0);
    return updateCell(state, row, column, {crystals, traps, treasures, numbersRevealed});
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
    if (state.shop || state.showAchievements || state.showOptions) return null;
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
function blowUpCell(state, firstCell, row, column, frameDelay = 0) {
    const columnz = z(column);
    const explored = state.rows[row] && state.rows[row][columnz] && state.rows[row][columnz].explored;
    if (!firstCell && (row < 0 || explored)) {
        return state;
    }
    const {x, y} = getCellCenter(state, row, column);
    const newExplosion = {...explosionSprite, x, y, frame: -frameDelay};
    state = createCell(state, row, column);
    state = addSprite(state, newExplosion);
    state = updateCell(state, row, column, {destroyed: true, explored: true, spriteId: newExplosion.id});
    // Lose 10% of max fuel for every explosion.
    const fuel = Math.max(0, Math.floor(state.saved.fuel - state.saved.maxFuel / 10));
    return updateSave(state, { fuel });
}

function detonateDebris(state, row, column) {
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
            state = blowUpCell(state, firstCell, cellCoords.row, cellCoords.column, frameDelay += 2);
        } else {
            const columnz = z(cellCoords.column);
            const explored = state.rows[cellCoords.row] && state.rows[cellCoords.row][columnz] &&
                                state.rows[cellCoords.row][columnz].explored;
            if (cellCoords.row >= 0 && !explored) {
                state = incrementAchievementStat(state, ACHIEVEMENT_PREVENT_X_EXPLOSIONS, 1);
                const {x, y} = getCellCenter(state, cellCoords.row, cellCoords.column);
                state = addSprite(state, {...shieldSprite, x, y, time: state.time + FRAME_LENGTH * frameDelay});
                frameDelay += 2;
            }
        }
        firstCell = false;
    }
    for (const coordsToUpdate of state.rows[row][z(column)].cellsToUpdate) {
        const cellToUpdate = state.rows[coordsToUpdate.row][z(coordsToUpdate.column)];
        const traps = cellToUpdate.traps - 1;
        // Mark cells with no nearby traps/crystals explored since numbers are already revealed.
        //let explored = cellToUpdate.explored || (!traps && !cellToUpdate.crystals && !cellToUpdate.treasures);
        state = updateCell(state, coordsToUpdate.row, coordsToUpdate.column, {traps});
    }
    state = {...state, waitingForExplosion: false};
    return state;
}

function emitPurchaseMessage(state) {
    console.log('Purchase the full game to dig deeper.');
    if (!state.emitPurchaseMessage) state.emitPurchaseMessageTimer = 3000;
    if (state.emitPurchaseMessageTimer) state.emitPurchaseMessageTimer += -1;
    return state = {...state, emitPurchaseMessage: true}
}

function exploreCell(state, row, column, usingExtractor = false) {
    let foundTreasure = false;
    state = revealCell(state, row, column);
    const fuelCost = getFuelCost(state, row, column);
    // const cellColor = 'treasure' || getCellColor(state, row, column);
    const cellColor = getCellColor(state, row, column);
    const {x, y} = getCellCenter(state, row, column);
    state = spawnDebris(state, x, y, row, column);
    if (cellColor === 'red') {
        state = addSprite(state, {
            ...shipDebrisSprite, x, y,
            row, column,
            index: random.range(0, 5),
            time: state.time + 200,
        });
        state = {...state, waitingForExplosion: true};
        // state = detonateDebris(state, row, column);
        state = updateSave(state, { fuel: Math.max(0, state.saved.fuel - fuelCost) })
    } else if (cellColor === 'treasure') {
        if (usingExtractor) {
            state = addSprite(state, {...diffuserSprite, x, y, time: state.time + 200});
        }
        foundTreasure = true;
        // const shipPartLocation = {row, column} || getShipPartLocation(state);
        const shipPartLocation = getShipPartLocation(state);
        // state = updateSave(state, {shipPart: 4});
        state = gainBonusFuel(state, 0.1 * fuelCost);
        if (shipPartLocation.row === row && shipPartLocation.column === column) {
            state = collectShipPart(state, row, column);
        } else {
            state = collectTreasure(state, row, column);
        }
        for (const coordsToUpdate of state.rows[row][z(column)].cellsToUpdate) {
            const cellToUpdate = state.rows[coordsToUpdate.row][z(coordsToUpdate.column)];
            const treasures = cellToUpdate.treasures - 1;
            // Mark cells with no nearby traps/crystals explored since numbers are already revealed.
            //let explored = cellToUpdate.explored || (!treasures && !cellToUpdate.crystals && !cellToUpdate.traps);
            state = updateCell(state, coordsToUpdate.row, coordsToUpdate.column, {treasures});
        }
    } else if (cellColor === 'green') {
        const depth = getDepth(state, row, column);

        const multiplier = getAchievementBonus(state, ACHIEVEMENT_COLLECT_X_CRYSTALS) / 100;
        const amount = Math.round((depth + 1) * Math.pow(1.05, depth) * (1 + multiplier));

        if (usingExtractor) {
            // Bonus fuel from crystals is just twice what collecting crystals would normally
            // grant, multiplied by the extractor perk.
            const bombDiffusionMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS) / 100;
            const bonusFuel = 0.2 * fuelCost * bombDiffusionMultiplier;
            const extractorSprite = {...bombSprite, x, y, bonusFuel, time: state.time + 400};
            state = addSprite(state, extractorSprite);
            // Crystals spawn closer together and are not collected.
            state = spawnCrystals(state, x, y, amount, EDGE_LENGTH / 4, {extractorTime: state.time + 400});
        } else {
            state = gainBonusFuel(state, 0.1 * fuelCost);
            state = spawnCrystals(state, x, y, amount);
        }

        for (const coordsToUpdate of state.rows[row][z(column)].cellsToUpdate) {
            const cellToUpdate = state.rows[coordsToUpdate.row][z(coordsToUpdate.column)];
            const crystals = cellToUpdate.crystals - 1;
            // Mark cells with no nearby traps/crystals explored since numbers are already revealed.
            // let explored = cellToUpdate.explored || (!crystals && !cellToUpdate.traps && !cellToUpdate.treasures);
            state = updateCell(state, coordsToUpdate.row, coordsToUpdate.column, {crystals});
        }
        if (!usingExtractor && depth > state.saved.lavaDepth - 11 && depth < Math.floor(state.saved.lavaDepth)) {
            if (!IS_DEMO) { // only lower lava if the full game is available
                const delta = Math.floor(state.saved.lavaDepth) - depth;
                state.saved.lavaDepth += 1.5 / delta;
                if (1.5 / delta >= 0.1) {
                    playSound(state, 'lowerLava');
                }
            }
            if (IS_DEMO) {
                emitPurchaseMessage(state);
            }
        }
    } else {
        // Using an energy extractor does not consume fuel.
        if (usingExtractor) {
            state = addSprite(state, {...diffuserSprite, x, y, time: state.time + 200});
        } else {
            state = updateSave(state, { fuel: Math.max(0, state.saved.fuel - fuelCost) })
        }
    }
    if (!state.saved.playedToday) {
        state = updateSave(state, { playedToday: true });
    }
    state = {
        ...state,
        robot: {...state.robot, row, column, animationTime: state.time, foundTreasure},
    };
    return state;
}
function getStartingCell(state) {
    return {row: Math.floor(state.startingDepth / 2), column: 0};
}

function teleportOut(state) {
    playSound(state, 'teleport');
    return showLeavingHint({
        ...state,
        leaving: true,
        robot: {...state.robot, teleporting: true, finishingTeleport: false, animationTime: state.time},
    });
}
function getTopTarget() {
    return Math.min(-canvas.height * 3, -2000);
}
const MAX_TELEPORT_SPEED = 25;

function advanceDigging(state) {
    const startingCell = getStartingCell(state);
    if (state.waitingForExplosion) {
        return state;
    }
    if (state.leaving) {
        // Don't start moving the camera until the robot has reached the end of the start animtion (the narrow beam).
        if (state.time - state.robot.animationTime < teleportOutAnimationStart.duration) {
            return state;
        }
        const targetTop = getTopTarget(state);
        let dy = Math.round((state.camera.top * 5 + targetTop) / 6) - state.camera.top;
        const multiplier = state.selected && state.selected.row >= 25 ? 2 : 1;
        dy = Math.max(-MAX_TELEPORT_SPEED * multiplier, Math.min(-5, dy));
        state = {...state, camera: {...state.camera,
            top: Math.max(targetTop, state.camera.top + dy),
        }};
        if (state.saved.skipAnimations) {
            state.camera.top = targetTop;
        }
        if (state.camera.top === targetTop) {
            if (!state.robot.finishingTeleport) {
                state = {...state, robot: {...state.robot, animationTime: state.time, finishingTeleport: true}};
            } else if (state.time - state.robot.animationTime >= teleportOutAnimationFinish.duration) {
                state = {...state, robot: false, leaving: false};
                if (state.collectingPart) {
                    state = updateSave({
                        ...state,
                        ship: state.time,
                        bgmTime: state.time,
                        outroTime: state.saved.shipPart >= 5 ? -2000 : false,
                    }, {playedToday: false});
                } else state = nextDay({...state, shop: state.time, ship: false, bgmTime: state.time});
            }
        }
        return state;
    }
    if (state.incoming) {
        if (!state.robot) {
            playSound(state, 'teleport');
            state = {...state, robot: {
                    row: startingCell.row, column: startingCell.column,
                    teleportingIn: true, animationTime: state.time
                }
            };
        }
        const targetLeft = startingCell.column * COLUMN_WIDTH + SHORT_EDGE + EDGE_LENGTH / 2 - canvas.width / 2;
        const rowOffset = (startingCell.column % 2) ? ROW_HEIGHT / 2 : 0;
        const targetTop = Math.max(-200, (startingCell.row + 0.5) * ROW_HEIGHT + rowOffset - canvas.height / 2);
        if (state.saved.skipAnimations) {
            state.camera.top = targetTop;
        }
        if (Math.abs(targetTop - state.camera.top) >= 5) {
            let dy = Math.round((state.camera.top * 5 + targetTop) / 6) - state.camera.top;
            const multiplier = startingCell.row >= 25 ? 2 : 1;
            dy = Math.min(multiplier * MAX_TELEPORT_SPEED, Math.max(5, dy));
            state = {...state, camera: {...state.camera,
                top: Math.min(targetTop, state.camera.top + dy),
                left: Math.round((state.camera.left * 20 + targetLeft) / 21)
            }};
        } else {
            if (!state.robot.finishingTeleport) {
                state = {...state, robot: {...state.robot, animationTime: state.time, finishingTeleport: true}};
            } else if (state.time - state.robot.animationTime >= teleportInAnimationFinish.duration) {
                state = {...state, incoming: false};
                // This needs to happen before we allow dragging, otherwise the min/max coords for camera
                // won't be set yet, which breaks dragging.
                if (!state.rows[startingCell.row]) {
                    state = {...state, robot: {...state.robot, teleportingIn: false, finishingTeleport: false, animationTime: state.time}};
                    state = exploreCell(state, startingCell.row, startingCell.column);
                    //state = revealCell(state, startingCell.row, startingCell.column);
                    //const {x, y} = getCellCenter(state, startingCell.row, startingCell.column);
                    //state = spawnDebris(state, x, y, startingCell.row, startingCell.column);
                    //state = {...state, selected: startingCell};
                    state = spawnLavaBubbles(state);
                    state = {...state, targetCell: startingCell, selected: startingCell};
                    //state.targetCell = state.selected;
                    //state = {...state, robot: {...state.robot, teleportingIn: false, finishingTeleport: false, animationTime: state.time}};
                }
            }
        }
        return state;
    }
    // Do nothing while the animation plays out for collecting a ship part.
    if (state.collectingPart) {
        if (state.robot.teleporting && state.time - state.robot.animationTime >= 1500) {
            state = {...state, ship: state.time, robot: {...state.robot, teleporting: false}};
        }
        return state;
    }
    // This flag will be used to show hints to the user if they fail to dig somewhere.
    let failedToExplore = false;
    if (state.instructionsAlpha <= 0 && (state.rightClicked || (state.clicked && state.usingBombDiffuser)) && state.overButton && state.overButton.cell) {
        const {row, column} = state.overButton;
        const fuelCost = getFuelCost(state, row, column);
        if (canExploreCell(state, row, column) && fuelCost <= state.saved.fuel) {
            if (state.saved.bombDiffusers > 0) {
                state = updateSave(state, {bombDiffusers: state.saved.bombDiffusers - 1});
                const cellColor = getCellColor(state, row, column);
                const {x, y} = getCellCenter(state, row, column);
                if (cellColor === 'red') {
                    state = revealCell(state, row, column);
                    const bombsDiffusedToday = state.saved.bombsDiffusedToday + 1;
                    state = updateSave(state, {bombsDiffusedToday});
                    state = incrementAchievementStat(state, ACHIEVEMENT_DIFFUSE_X_BOMBS, 1);
                    const bombDiffusionMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS) / 100;
                    const bonusFuel = state.saved.maxFuel * 0.05 * bombDiffusionMultiplier;
                    // Decrease the bomb count around the diffused bomb
                    for (const coordsToUpdate of state.rows[row][z(column)].cellsToUpdate) {
                        const cellToUpdate = state.rows[coordsToUpdate.row][z(coordsToUpdate.column)];
                        const traps = cellToUpdate.traps - 1;
                        // Mark cells with no nearby traps/crystals/treasures explored since numbers are already revealed.
                        //let explored = cellToUpdate.explored || (!traps && !cellToUpdate.crystals && !cellToUpdate.treasures);
                        state = updateCell(state, coordsToUpdate.row, coordsToUpdate.column, {traps});
                    }
                    state = addSprite(state, {...bombSprite, x, y, bonusFuel, time: state.time + 400});
                    state = addSprite(state, {
                        ...shipDebrisSprite,
                        defuseIn: 400,
                        index: random.range(0, 5), x, y,
                        time: state.time,
                    });
                } else {
                    state = exploreCell(state, row, column, true);
                }
            } else {
                const selectedRow = [...(state.flags[row] || [])];
                let flagValue = getFlagValue(state, row, column) || 0;
                playSound(state, 'flag');
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
        } else if (canExploreCell(state, row, column) && fuelCost > state.saved.fuel) {
            failedToExplore = true;
        }
        state = {...state, usingBombDiffuser: false, clicked: false, rightClicked: false};
    }
    if (state.instructionsAlpha <= 0 && !state.rightClicked && state.clicked && state.overButton && state.overButton.cell) {
        const {row, column} = state.overButton;
        const fuelCost = getFuelCost(state, row, column);
        if (canExploreCell(state, row, column) && getFlagValue(state, row, column) !== 2) {
            if (fuelCost <= state.saved.fuel) {
                state = exploreCell(state, row, column);
            } else {
                failedToExplore = true;
            }
        }
        if (isCellRevealed(state, row, column) || getFlagValue(state, row, column)) {
            state.selected = state.overButton;
            if (!state.saved.disableAutoscroll) {
                state.targetCell = state.selected;
            }
        }
    }
    if (failedToExplore) {
        if (state.saved.fuel === 0 || (state.saved.day <= 5 && state.saved.fuel <= 5)) {
            state = showSpecialHint(state, ['Click the teleport button to', 'return to the ship and recharge']);
            state.hintButton = getSleepButton();
        } else {
            state = showSpecialHint(state, ['You need more energy to dig this deep,', 'try digging higher up.']);
        }
    }
    if (state.targetCell) {
        const targetLeft = state.targetCell.column * COLUMN_WIDTH + SHORT_EDGE + EDGE_LENGTH / 2 - canvas.width / 2;
        const rowOffset = (state.targetCell.column % 2) ? ROW_HEIGHT / 2 : 0;
        const targetTop = Math.max(-200, (state.targetCell.row + 0.5) * ROW_HEIGHT + rowOffset - canvas.height / 2);
        state = {...state, camera: {...state.camera,
            top: Math.round((state.camera.top * 10 + targetTop) / 11),
            left: Math.round((state.camera.left * 10 + targetLeft) / 11)
        }}
    }
    let saved = state.saved;
    let displayFuel = state.displayFuel;
    if (displayFuel < state.saved.fuel) displayFuel = Math.ceil((displayFuel * 10 + state.saved.fuel) / 11);
    if (displayFuel > state.saved.fuel) displayFuel = Math.floor((displayFuel * 10 + state.saved.fuel) / 11);
    let displayLavaDepth = state.displayLavaDepth;
    if (displayLavaDepth < state.saved.lavaDepth) displayLavaDepth = Math.min(displayLavaDepth + 0.01, state.saved.lavaDepth);
    if (displayLavaDepth > state.saved.lavaDepth) displayLavaDepth = Math.max(displayLavaDepth - 0.01, state.saved.lavaDepth);
    return {...state, displayFuel, displayLavaDepth, saved };
}
function spawnCrystals(state, x, y, amount, radius = EDGE_LENGTH - EDGE_LENGTH / 2, props = {}) {
    const crystalValues = [];
    for (let sizeIndex = CRYSTAL_SIZES.length - 1; sizeIndex >= 0; sizeIndex--) {
        const crystalSize = CRYSTAL_SIZES[sizeIndex];
        while (amount >= crystalSize && crystalValues.length < 10) {
            crystalValues.push(crystalSize);
            amount -= crystalSize;
        }
    }
    crystalValues.reverse();
    const theta = Math.random() * Math.PI / 2;
    const stagger = 6;
    let frame = -5 - stagger * crystalValues.length;
    for (let i = 0; i < crystalValues.length; i++) {
        const crystalValue = crystalValues[i];
        const t = theta + Math.PI * 2 * 2 * i / 7;
        const r = 0.3 * EDGE_LENGTH * Math.cos(Math.PI / 2 * i / 10);
        state = addSprite(state, {
            ...crystalSprite,
            x: x + r * Math.cos(t),
            y: y + r * Math.sin(t),
            frame: frame += stagger,
            crystals: crystalValue,
            ...props,
            i,
        });
    }
    return state;
}
function spawnDebris(state, x, y, row, column) {
    playSound(state, 'dig');
    if (state.saved.hideParticles) {
        return state;
    }
    let index = row - 3 + 6 * random.normSeed(Math.cos(row) + Math.sin(z(column)));
    index = Math.min(Math.max(0, Math.floor(index / 10)), particleAnimations.length - 1);
    let dx = -SHORT_EDGE;
    while (dx < SHORT_EDGE) {
        const animation = random.element(particleAnimations[index]);
        state = addSprite(state, {
            ...debrisSprite,
            x: x + dx,
            y: y + Math.random() * EDGE_LENGTH - EDGE_LENGTH / 2,
            vx: 5 * dx / SHORT_EDGE,
            vy: -2 - 2*Math.random(),
            animation,
        });
        dx += SHORT_EDGE / 4 + SHORT_EDGE * Math.random() / 8;
    }
    return state;
}
function spawnLavaBubbles(state) {
    for (let i = 0; i < 10; i++) {
        const animation = lavaBubbleAnimations[i % 4 ? 0 : 1];
        state = addSprite(state, {
            ...lavaBubbleSprite,
            x: canvas.width * i / 10 + Math.floor(Math.random() * 20) - 10,
            y: 2 + Math.floor(Math.random() * 10),
            animation,
            spawnTime: state.time - FRAME_LENGTH * Math.floor(Math.random() *  40),
        });
    }
    return state;
}
function gainCrystals(state, amount) {
    const score = state.saved.score + amount;
    const crystalsCollectedToday = state.saved.crystalsCollectedToday + amount;
    state = updateSave(state, {score, crystalsCollectedToday});
    return incrementAchievementStat(state, ACHIEVEMENT_COLLECT_X_CRYSTALS, amount);
}
function gainBonusFuel(state, amount) {
    const bonusFuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS) / 100;
    amount = Math.round(amount * bonusFuelMultiplier);
    const fuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY) / 100;
    const fuel = Math.min(Math.round(state.saved.maxFuel * fuelMultiplier), state.saved.fuel + amount);
    const bonusFuelToday = state.saved.bonusFuelToday + amount;
    return updateSave(state, { fuel, bonusFuelToday });
}

