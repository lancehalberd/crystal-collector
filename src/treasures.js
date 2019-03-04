
const random = require('random');
const Rectangle = require('Rectangle');
const { drawImage } = require('draw');

const { canvas } = require('gameConstants');

const { r, createAnimation, getFrame } = require('animations');

export {
    collectTreasure,
};
const { updateSave } = require('state');
const { addSprite, deleteSprite, updateSprite } = require('sprites');

const {
    getAchievementBonus,
    ACHIEVEMENT_COLLECT_X_CRYSTALS,
} = require('achievements');

const {
    createCellsInRange,
    getCellCenter,
    getDepth,
    getFuelCost,
    spawnCrystals,
    gainBonusFuel,
} = require('digging');


function collectTreasure(state, row, column) {
    const type = random.element(Object.keys(treasures));
    return treasures[type].activate(state, row, column);
}

const treasures = {
    radar: {
        activate(state, row, column) {
            const {x, y} = getCellCenter(state, row, column);
            state = addSprite(state, {...radarSprite, x, y, row, column, time: state.time});
            return state;
        },
    },
    chest: {
        activate(state, row, column) {
            const {x, y} = getCellCenter(state, row, column);
            state = addSprite(state, {...chestSprite, x, y, row, column, time: state.time});
            return state;
        },
    },
    energy: {
        activate(state, row, column) {
            const {x, y} = getCellCenter(state, row, column);
            const fuelCost = getFuelCost(state, row, column);
            const bonusFuel = Math.max(50, 2 * fuelCost);
            state = addSprite(state, {...energySprite, x, y, time: state.time, bonusFuel});
            return state;
        },
    },
    bombDiffusers: {
        activate(state, row, column) {
            const {x, y} = getCellCenter(state, row, column);
            const depth = getDepth(state, row, column);
            const amount = Math.max(2, Math.min(5, Math.round(depth / 20)));
            state = addSprite(state, {...diffuserSprite, x, y, time: state.time, amount});
            return state;
        },
    }
};

const radarAnimation = createAnimation('gfx/bonus.png', r(25, 25), {cols: 4}, {loop: false});
const radarSprite = {
    advance(state, sprite) {
        if (state.time - sprite.time === 1200) {
            state = createCellsInRange(state, sprite.row, sprite.column, true);
        }
        if (state.time - sprite.time > 1600) return deleteSprite(state, sprite);
        return state;
    },
    render(context, state, sprite) {
        const animationTime = state.time - sprite.time;
        if (animationTime < 0) return;
        const frame = getFrame(radarAnimation, animationTime);
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
        if (animationTime > 800) {
            context.save();
            const p = (animationTime - 800) / 800;
            context.globalAlpha = Math.max(0, Math.min(0.6, 2 - 2 * p));
            const size = 250 * Math.min(1, 2 * p);
            context.beginPath();
            context.fillStyle = '#0AF';
            context.ellipse(sprite.x - state.camera.left, sprite.y - state.camera.top, size, size, 0, 0, Math.PI * 2);
            context.fill();
            context.restore();
        }
    }
};

const chestAnimation = createAnimation('gfx/bonus.png', r(25, 25), {x: 4, cols: 2, duration: 20}, {loop: false});
const chestSprite = {
    advance(state, sprite) {
        if (state.time - sprite.time === 400) {
            const {x, y} = getCellCenter(state, sprite.row, sprite.column);
            const depth = getDepth(state, sprite.row, sprite.column);
            const multiplier = getAchievementBonus(state, ACHIEVEMENT_COLLECT_X_CRYSTALS) / 100;
            const amount = 100 * Math.round((depth + 1) * Math.pow(1.05, depth) * (1 + multiplier) / 10);
            state = spawnCrystals(state, x, y, Math.max(100, amount), 10);
        }
        if (state.time - sprite.time > 1200) return deleteSprite(state, sprite);
        return state;
    },
    render(context, state, sprite) {
        const animationTime = state.time - sprite.time;
        if (animationTime < 0) return;
        const frame = getFrame(chestAnimation, animationTime);
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
    }
};

const energyAnimation = createAnimation('gfx/diffuse.png', r(25, 25), {x: 4});
const energySprite = {
    advance(state, sprite) {
        if (sprite.y < state.camera.top + 20) {
            state = gainBonusFuel(state, sprite.bonusFuel);
            return deleteSprite(state, sprite);
        }
        let {x = 0, y = 0, vx = 0, vy = 0, frame = 0} = sprite;
        x += vx;
        y += vy;
        frame++;
        if (state.time - sprite.time > 500) {
            vx += (state.camera.left + 200 - x) / 300;
            vy += (state.camera.top - y) / 300;
        }
        return updateSprite(state, sprite, {frame, x, y, vx, vy});
    },
    render(context, state, sprite) {
        const animationTime = state.time - sprite.time;
        if (animationTime < 0) return;
        const frame = getFrame(energyAnimation, animationTime);
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
    }
};

const diffuserAnimation = createAnimation('gfx/diffuse.png', r(25, 25), {x: 1});
const diffuserSprite = {
    advance(state, sprite) {
        if (sprite.y > state.camera.top + canvas.height - 80 && sprite.x < state.camera.left + 60) {
            state = updateSave(state, {bombDiffusers: state.saved.bombDiffusers + sprite.amount});
            return deleteSprite(state, sprite);
        }
        let {x = 0, y = 0, vx = 0, vy = 0, frame = 0} = sprite;
        x += vx;
        y += vy;
        frame++;
        const animationTime = state.time - sprite.time;
        if (animationTime > 500) {
            const p = Math.min(1, ((animationTime - 500) / 500));
            const dx = state.camera.left + 30 - x, dy = state.camera.top + canvas.height - 40 - y;
            const m = Math.sqrt(dx*dx+dy*dy);
            if (m) {
                vx = vx * (1 - p) + 15 * p * dx / m;
                vy = vy * (1 - p) + 15 * p * dy / m;
            }
        }
        return updateSprite(state, sprite, {frame, x, y, vx, vy});
    },
    render(context, state, sprite) {
        const animationTime = state.time - sprite.time;
        if (animationTime < 0) return;
        const frame = getFrame(diffuserAnimation, animationTime);
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top)
        );
    }
};
